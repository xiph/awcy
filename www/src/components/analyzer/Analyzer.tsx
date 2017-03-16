import * as React from "react";
import { OverlayTrigger, Tooltip, ButtonGroup, Pagination, Button, Panel, Form, FormGroup, ControlLabel, FormControl, ButtonToolbar, Glyphicon, SplitButton, MenuItem, DropdownButton, Tabs, Tab } from "react-bootstrap";
import { } from "react-bootstrap";
import { hashString, appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile, fileExists, analyzerBaseUrl, baseUrl } from "../../stores/Stores";
import { COLORS, HEAT_COLORS, Decoder, Rectangle, Size, AnalyzerFrame, loadFramesFromJson, downloadFile, Histogram, Accounting, AccountingSymbolMap, clamp, Vector, localFiles, localFileProtocol } from "./analyzerTools";
import { Promise } from "es6-promise";
import { HistogramComponent } from "./Histogram";

declare var d3;
declare var Mousetrap;

const DEFAULT_MARGIN = { top: 10, right: 10, bottom: 20, left: 40 };
const MAX_FRAMES = 128;
const MI_SIZE_LOG2 = 3;
const MI_SIZE = 1 << MI_SIZE_LOG2;
const CLPF_SIZE_LOG2 = 5;
const SUPER_MI_SIZE = MI_SIZE << 3;
const ZOOM_WIDTH = 500;
const ZOOM_SOURCE = 64;
const DEFAULT_CONFIG = "--disable-multithread --disable-runtime-cpu-detect --target=generic-gnu --enable-accounting --enable-analyzer --enable-aom_highbitdepth --extra-cflags=-D_POSIX_SOURCE";


function colorScale(v, colors) {
  return colors[Math.round(v * (colors.length - 1))];
}

function keyForValue(o: Object, value: any): string {
  if (o) {
    for (let k in o) {
      if (o[k] === value) {
        return k;
      }
    }
  }
  return String(value);
}

const BLOCK_SIZES = [
  [2, 2],
  [2, 3],
  [3, 2],
  [3, 3],
  [3, 4],
  [4, 3],
  [4, 4],
  [4, 5],
  [5, 4],
  [5, 5],
  [5, 6],
  [6, 5],
  [6, 6]
];

function shuffle(array: any [], count: number) {
  // Shuffle Indices
  for (let j = 0; j < count; j++) {
    let a = Math.random() * array.length | 0;
    let b = Math.random() * array.length | 0;
    let t = array[a];
    array[a] = array[b];
    array[b] = t;
  }
}

function blockSizeArea(size: number) {
  return (1 << BLOCK_SIZES[size][0]) * (1 << BLOCK_SIZES[size][1]);
}
function forEachValue(o: any, fn: (v: any) => void) {
  for (let n in o) {
    fn(o[n]);
  }
}
function fractionalBitsToString(v: number) {
  if (v > 16) {
    return ((v / 8) | 0).toLocaleString();
  }
  return (v / 8).toLocaleString();
}
function toPercent(v: number) {
  return (v * 100).toFixed(1);
}
function withCommas(v: number) {
  return v.toLocaleString();
}
function toByteSize(v: number) {
  return withCommas(v) + " Bytes";
}

function getLineOffset(lineWidth: number) {
  return lineWidth % 2 == 0 ? 0 : 0.5;
}

function drawSplit(ctx, x, y, dx, dy) {
  ctx.beginPath();
  ctx.save();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y);
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + dy);
  ctx.restore();
  ctx.closePath();
  ctx.stroke();
}

function drawVector(ctx: CanvasRenderingContext2D, a: Vector, b: Vector) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.closePath();
  ctx.stroke();
  return;
}

function drawLine(ctx: CanvasRenderingContext2D, x, y, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.closePath();
  ctx.stroke();
}

interface BlockVisitor {
  (size: number, c: number, r: number, sc: number, sr: number, bounds: Rectangle): void;
}

interface AnalyzerViewProps {
  groups: AnalyzerFrame[][],
  groupNames?: string[],
  playbackFrameRate?: number;
  blind?: number;
}

export class AccountingComponent extends React.Component<{
  symbols: AccountingSymbolMap;
}, {

}> {
  render() {
    let symbols = this.props.symbols;
    let total = 0;
    forEachValue(symbols, (symbol) => {
      total += symbol.bits;
    });

    let rows = []
    for (let name in symbols) {
      let symbol = symbols[name];
      rows.push(<tr key={name}>
        <td className="propertyName">{name}</td>
        <td className="propertyValue" style={{textAlign: "right"}}>{fractionalBitsToString(symbol.bits)}</td>
        <td className="propertyValue" style={{textAlign: "right"}}>{toPercent(symbol.bits / total)}</td>
        <td className="propertyValue" style={{textAlign: "right"}}>{withCommas(symbol.samples)}</td>
      </tr>);
    }

    return <div className="symbolTable">
      <table>
        <thead>
          <tr>
            <td style={{width: "140px"}}>Symbol</td>
            <td style={{textAlign: "right"}}>Bits {fractionalBitsToString(total)}</td>
            <td style={{textAlign: "right"}}>%</td>
            <td style={{textAlign: "right"}}>Samples</td>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </table>
    </div>
  }
}

export class FrameInfoComponent extends React.Component<{
  frame: AnalyzerFrame;
  activeFrame: number;
  activeGroup: number;
}, {

}> {
  render() {
    let frame = this.props.frame;
    function getProperty(name: string): string{
      if (frame.json[name] == undefined) return "N/A";
      return frame.json[name];
    }
    return <div id="frameInfoSection">
      <div style={{float: "left", width: "40%"}}>
        <div><span className="propertyName">Video:</span> <span className="propertyValue">{this.props.activeGroup}</span></div>
        <div><span className="propertyName">Frame:</span> <span className="propertyValue">{this.props.activeFrame}</span></div>
        <div><span className="propertyName">Frame Type:</span> <span className="propertyValue">{frame.json.frameType}</span></div>
        <div><span className="propertyName">Show Frame:</span> <span className="propertyValue">{frame.json.showFrame}</span></div>
      </div>
      <div style={{float: "left", width: "60%"}}>
        <div><span className="propertyName">BaseQIndex:</span> <span className="propertyValue">{frame.json.baseQIndex}</span></div>
        <div><span className="propertyName">Frame Size:</span> <span className="propertyValue">{frame.imageData.width} x {frame.imageData.height}</span></div>
        <div><span className="propertyName">CLPF Size:</span> <span className="propertyValue">{getProperty("clpfSize")}</span></div>
        <div><span className="propertyName">CLPF Strength Y:</span> <span className="propertyValue">{getProperty("clpfStrengthY")}</span></div>
      </div>
    </div>
  }
}

export class ModeInfoComponent extends React.Component<{
  frame: AnalyzerFrame;
  position: Vector;
}, {

}> {
  render() {
    let c = this.props.position.x;
    let r = this.props.position.y;
    let json = this.props.frame.json;
    function getProperty(name: string): string{
      if (!json[name]) return "N/A";
      let v = json[name][r][c];
      if (!json[name + "Map"]) return String(v);
      return keyForValue(json[name + "Map"], v);
    }
    function getSuperBlockProperty(name: string): string{
      if (!json[name]) return "N/A";
      let v = json[name][r & ~7][c & ~7];
      if (!json[name + "Map"]) return String(v);
      return keyForValue(json[name + "Map"], v);
    }
    function getMotionVector() {
      let motionVectors = json["motionVectors"];
      if (!motionVectors) return "N/A";
      let v = motionVectors[r][c];
      return `${v[0]},${v[1]} ${v[2]},${v[3]}`;
    }
    function getReferenceFrame() {
      let referenceFrame = json["referenceFrame"];
      if (!referenceFrame) return "N/A";
      let map = json["referenceFrameMap"];
      let v = referenceFrame[r][c];
      let a = v[1] >= 0 ? keyForValue(map, v[0]) : "N/A";
      let b = v[1] >= 0 ? keyForValue(map, v[1]) : "N/A";
      return `${a}, ${b}`;
    }
    return <div id="modeInfoSection">
      <div style={{float: "left", width: "40%"}}>
        <div><span className="propertyName">Block:</span> <span className="propertyValue">{c}x{r}</span></div>
        <div><span className="propertyName">Block Size:</span> <span className="propertyValue">{getProperty("blockSize")}</span></div>
        <div><span className="propertyName">Tx Size:</span> <span className="propertyValue">{getProperty("transformSize")}</span></div>
        <div><span className="propertyName">Tx Type:</span> <span className="propertyValue">{getProperty("transformType")}</span></div>
      </div>
      <div style={{float: "left", width: "60%"}}>
        <div><span className="propertyName">Mode:</span> <span className="propertyValue">{getProperty("mode")}</span></div>
        <div><span className="propertyName">Skip:</span> <span className="propertyValue">{getProperty("skip")}</span></div>
        <div><span className="propertyName">Dering:</span> <span className="propertyValue">{getSuperBlockProperty("deringGain")}</span></div>
        <div><span className="propertyName">CLPF:</span> <span className="propertyValue">{getProperty("clpf")}</span></div>
        <div><span className="propertyName">Motion Vectors:</span> <span className="propertyValue">{getMotionVector()}</span></div>
        <div><span className="propertyName">Reference Frame:</span> <span className="propertyValue">{getReferenceFrame()}</span></div>
      </div>
    </div>
  }
}

export class AnalyzerView extends React.Component<AnalyzerViewProps, {
    activeFrame: number;
    activeGroup: number;
    scale: number;
    showDecodedImage: boolean;
    showMotionVectors: boolean;
    showReferenceFrames: boolean;
    showBlockGrid: boolean;
    showSuperBlockGrid: boolean;
    showTransformGrid: boolean;
    showSkip: boolean;
    showDering: boolean;
    showCLPF: boolean;
    showMode: boolean;
    showBits: boolean;
    showBitsScale: "frame" | "video" | "videos";
    showBitsMode: "linear" | "heat" | "heat-opaque";
    showBitsFilter: "";
    showTransformType: boolean;
    showTools: boolean;
    showFrameComment: boolean;
    activeGroupMap: number [][];
  }> {
  public static defaultProps: AnalyzerViewProps = {
    groups: [],
    groupNames: null,
    playbackFrameRate: 30,
    blind: 0
  };

  activeGroupScore: number [][];
  playInterval;
  ratio: number;
  frameSize: Size;
  paddedFrameSize: Size;
  frameCanvas: HTMLCanvasElement;
  frameContext: CanvasRenderingContext2D;
  displayCanvas: HTMLCanvasElement;
  displayContext: CanvasRenderingContext2D;
  overlayCanvas: HTMLCanvasElement;
  overlayContext: CanvasRenderingContext2D;
  zoomCanvas: HTMLCanvasElement;
  zoomContext: CanvasRenderingContext2D;
  compositionCanvas: HTMLCanvasElement;
  compositionContext: CanvasRenderingContext2D = null;

  toast: HTMLDivElement;
  toastTimeout: any;
  mousePosition: Vector;
  mouseZoomPosition: Vector;

  options = {
    // showY: {
    //   key: "y",
    //   description: "Y",
    //   detail: "Display Y image plane.",
    //   updatesImage: true,
    //   default: true,
    //   value: undefined
    // },
    // showU: {
    //   key: "u",
    //   description: "U",
    //   detail: "Display U image plane.",
    //   updatesImage: true,
    //   default: true,
    //   value: undefined
    // },
    // showV: {
    //   key: "v",
    //   description: "V",
    //   detail: "Display V image plane.",
    //   updatesImage: true,
    //   default: true,
    //   value: undefined
    // },
    // showOriginalImage: {
    //   key: "w",
    //   description: "Original Image",
    //   detail: "Display loaded .y4m file.",
    //   updatesImage: true,
    //   default: false,
    //   disabled: true,
    //   value: undefined
    // },
    showDecodedImage: {
      key: "i",
      description: "Decoded Image",
      detail: "Display decoded image.",
      updatesImage: true,
      default: true,
      value: undefined,
      icon: "glyphicon glyphicon-picture" // glyphicon glyphicon-film
    },
    // showPredictedImage: {
    //   key: "p",
    //   description: "Predicted Image",
    //   detail: "Display the predicted image, or the residual if the decoded image is displayed.",
    //   updatesImage: true,
    //   default: false,
    //   value: undefined
    // },
    showSuperBlockGrid: {
      key: "g",
      description: "Super Block Grid",
      detail: "Display the 64x64 super block grid.",
      default: false,
      value: undefined,
      icon: "glyphicon glyphicon-th-large"
    },
    showBlockGrid: {
      key: "s",
      description: "Split Grid",
      detail: "Display block partitions.",
      default: false,
      value: undefined,
      icon: "glyphicon glyphicon-th"
    },
    // showTileGrid: {
    //   key: "l",
    //   description: "Tile Grid",
    //   detail: "Display tile grid.",
    //   default: false,
    //   value: undefined
    // },
    showTransformGrid: {
      key: "t",
      description: "Tx Grid",
      detail: "Display transform blocks.",
      default: false,
      value: undefined
    },
    showTransformType: {
      key: "y",
      description: "Tx Type",
      detail: "Display transform type.",
      default: false,
      value: undefined
    },
    // showDering: {
    //   key: "d",
    //   description: "Dering",
    //   detail: "Display blocks where the deringing filter is applied.",
    //   default: false,
    //   value: undefined
    // },
    // showCLPF: {
    //   key: "l",
    //   description: "CLFP",
    //   detail: "Display blocks where the CLPF filter is applied.",
    //   default: false,
    //   value: undefined
    // },
    showMotionVectors: {
      key: "m",
      description: "Motion Vectors",
      detail: "Display motion vectors.",
      default: false,
      value: undefined
    },
    showReferenceFrames: {
      key: "f",
      description: "Frame References",
      detail: "Display frame references.",
      default: false,
      value: undefined,
      icon: "glyphicon glyphicon-transfer"
    },
    showMode: {
      key: "o",
      description: "Mode",
      detail: "Display prediction modes.",
      default: false,
      value: undefined
    },
    showBits: {
      key: "b",
      description: "Bits",
      detail: "Display bits.",
      default: false,
      value: undefined
    },
    showSkip: {
      key: "k",
      description: "Skip",
      detail: "Display skip flags.",
      default: false,
      value: undefined
    }
  };
  constructor(props: AnalyzerViewProps) {
    super();
    let ratio = window.devicePixelRatio || 1;
    let activeGroupMap = [];
    let activeGroupScore = [];

    let map = [];
    for (let i = 0; i < props.groups.length; i++) {
      map.push(i);
    }
    if (props.blind) {
      shuffle(map, 16);
    }
    for (let i = 0; i < 1024; i++) {
      let score = [];
      for (let j = 0; j < props.groups.length; j++) {
        score.push(0);
      }
      activeGroupMap.push(map);
      activeGroupScore.push(score);
    }
    this.state = {
      activeFrame: -1,
      activeGroup: 0,
      scale: 1,
      showBlockGrid: false,
      showSuperBlockGrid: false,
      showTransformGrid: false,
      showSkip: false,
      showDering: false,
      showCLPF: false,
      showMode: false,
      showBits: false,
      showBitsScale: "frame",
      showBitsMode: "heat",
      showBitsFilter: "",
      showDecodedImage: true,
      showMotionVectors: false,
      showReferenceFrames: false,
      showTools: !props.blind,
      showFrameComment: false,
      activeGroupMap: activeGroupMap
    } as any;
    this.ratio = ratio;
    this.frameCanvas = document.createElement("canvas");
    this.frameContext = this.frameCanvas.getContext("2d");
    this.compositionCanvas = document.createElement("canvas");
    this.compositionContext = this.compositionCanvas.getContext("2d");
    this.mousePosition = new Vector(128, 128);
    this.mouseZoomPosition = new Vector(128, 128);
    this.activeGroupScore = activeGroupScore;
  }
  resetCanvas(w: number, h: number) {
    let scale = this.state.scale;
    this.frameSize = new Size(w, h);
    this.paddedFrameSize = this.frameSize.clone().roundUpToMultipleOfLog2(MI_SIZE_LOG2);

    this.frameCanvas.width = w;
    this.frameCanvas.height = h;
    this.compositionCanvas.width = w;
    this.compositionCanvas.height = h;

    this.displayCanvas.style.width = (w * scale) + "px";
		this.displayCanvas.style.height = (h * scale) + "px";
    this.displayCanvas.width = w * scale * this.ratio;
		this.displayCanvas.height = h * scale * this.ratio;
    this.displayContext = this.displayCanvas.getContext("2d");

    this.overlayCanvas.style.width = (w * scale) + "px";
		this.overlayCanvas.style.height = (h * scale) + "px";
    this.overlayCanvas.width = w * scale * this.ratio;
		this.overlayCanvas.height = h * scale * this.ratio;
    this.overlayContext = this.overlayCanvas.getContext("2d");

    this.zoomCanvas.style.width = ZOOM_WIDTH + "px";
		this.zoomCanvas.style.height = ZOOM_WIDTH + "px";
    this.zoomCanvas.width = ZOOM_WIDTH * this.ratio;
		this.zoomCanvas.height = ZOOM_WIDTH * this.ratio;
    this.zoomContext = this.zoomCanvas.getContext("2d");
  }
  showToast(message: string, duration = 1000) {
    this.toast.innerHTML = message;
    let opacity = 1;
    this.toast.style.opacity = String(opacity);
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = 0;
    }
    this.toastTimeout = setTimeout(() => {
      let interval = setInterval(() => {
        this.toast.style.opacity = String(opacity);
        opacity -= 0.1;
        if (opacity < 0) {
          clearInterval(interval);
        }
      }, 16);
    }, duration);
  }
  draw(group: number, index: number) {
    let frame = this.props.groups[group][index];
    this.frameContext.putImageData(frame.imageData, 0, 0);

    // Draw frameCanvas to displayCanvas
    (this.displayContext as any).imageSmoothingEnabled = false;
    this.displayContext.mozImageSmoothingEnabled = false;
    let dw = this.frameSize.w * this.state.scale * this.ratio;
    let dh = this.frameSize.h * this.state.scale * this.ratio;
    if (this.state.showDecodedImage) {
      this.displayContext.drawImage(this.frameCanvas, 0, 0, dw, dh);
    } else {
      this.displayContext.fillStyle = "#333333";
      this.displayContext.fillRect(0, 0, dw, dh);
    }

    if (this.props.blind) {
      return;
    }

    // Draw Layers
    let scale = this.state.scale;
    let ctx = this.overlayContext;
    let ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, this.frameSize.w * scale * ratio, this.frameSize.h * scale * ratio);

    let src = Rectangle.createRectangleFromSize(this.frameSize);
    let dst = src.clone().multiplyScalar(scale * this.ratio);

    this.drawLayers(frame, ctx, src, dst);

    if (this.state.showTools) {
      ctx.save();
      ctx.strokeStyle = "white";
      ctx.setLineDash([2, 4]);
      let w = ZOOM_SOURCE * ratio * scale;
      ctx.strokeRect(this.mouseZoomPosition.x * ratio - w / 2,
                     this.mouseZoomPosition.y * ratio - w / 2, w, w);
      let r = this.getParentMIRect(frame, this.mousePosition);
      if (r) {
        ctx.strokeStyle = "orange";
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeRect(r.x * ratio * scale, r.y * ratio * scale, r.w * ratio * scale, r.h * ratio * scale);
      }
      ctx.restore();
    }
  }
  drawZoom(group: number, index: number) {
    let frame = this.props.groups[group][index];
    let mousePosition = this.mouseZoomPosition.clone().divideScalar(this.state.scale).snap();
    let src = Rectangle.createRectangleCenteredAtPoint(mousePosition, ZOOM_SOURCE, ZOOM_SOURCE);
    let dst = new Rectangle(0, 0, ZOOM_WIDTH * this.ratio, ZOOM_WIDTH * this.ratio);

    this.zoomContext.clearRect(0, 0, dst.w, dst.h);
    if (this.state.showDecodedImage) {
      this.zoomContext.mozImageSmoothingEnabled = false;
      (this.zoomContext as any).imageSmoothingEnabled = false;
      this.zoomContext.clearRect(dst.x, dst.y, dst.w, dst.h);
      this.zoomContext.drawImage(this.frameCanvas,
        src.x, src.y, src.w, src.h,
        dst.x, dst.y, dst.w, dst.h);
    }
    this.drawLayers(frame, this.zoomContext, src, dst);
  }
  drawLayers(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    this.state.showSkip && this.drawSkip(frame, ctx, src, dst);
    this.state.showMode && this.drawMode(frame, ctx, src, dst);
    this.state.showBits && this.drawBits(frame, ctx, src, dst);
    this.state.showDering && this.drawDering(frame, ctx, src, dst);
    this.state.showCLPF && this.drawCLPF(frame, ctx, src, dst);
    this.state.showTransformType && this.drawTransformType(frame, ctx, src, dst);
    this.state.showMotionVectors && this.drawMotionVectors(frame, ctx, src, dst);
    this.state.showReferenceFrames && this.drawReferenceFrames(frame, ctx, src, dst);
    ctx.globalAlpha = 1;
    this.state.showSuperBlockGrid && this.drawGrid(frame, "super-block", "#87CEEB", ctx, src, dst, 2);
    this.state.showTransformGrid && this.drawGrid(frame, "transform", "yellow", ctx, src, dst);
    this.state.showBlockGrid && this.drawGrid(frame, "block", "white", ctx, src, dst);
    ctx.restore();

  }
  drawGrid(frame: AnalyzerFrame, mode: string, color: string, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle, lineWidth = 1) {
    let scale = dst.w / src.w;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    let lineOffset = getLineOffset(lineWidth);
    ctx.translate(lineOffset, lineOffset);
    ctx.translate(-src.x * scale, -src.y * scale);
    ctx.lineWidth = lineWidth;
    this.visitBlocks(mode, frame, (blockSize, c, r, sc, sr, bounds) => {
      bounds.multiplyScalar(scale);
      drawSplit(ctx, bounds.x, bounds.y, bounds.w, bounds.h);
    });
    ctx.restore();
  }
  componentDidMount() {
    if (!this.props.groups.length)
      return;
    this.reset();
    this.installKeyboardShortcuts();
    this.advanceFrame(1);

    this.overlayCanvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.overlayCanvas.addEventListener("mousedown", this.onMouseDown.bind(this));
  }
  componentDidUpdate(prevProps, prevState) {
    let imageData = this.props.groups[this.getActiveGroupIndex()][0].imageData;
    let frameSizeChanged = this.frameSize.w !== imageData.width || this.frameSize.h != imageData.height;
    if (this.state.scale != prevState.scale || frameSizeChanged) {
      this.reset();
    }
    if (this.state.activeFrame >= 0) {
      this.draw(this.getActiveGroupIndex(), this.state.activeFrame);
      this.drawZoom(this.getActiveGroupIndex(), this.state.activeFrame);
    }
  }
  reset() {
    let imageData = this.props.groups[this.getActiveGroupIndex()][0].imageData;
    let w = imageData.width, h = imageData.height;
    this.resetCanvas(w, h);
  }
  handleSelect(frame) {
    this.setState({
      activeFrame: frame
    } as any);
  }
  playPause() {
    if (!this.playInterval) {
      this.playInterval = setInterval(() => {
        this.advanceFrame(1);
      }, 1000 / this.props.playbackFrameRate);
    } else {
      clearInterval(this.playInterval);
      this.playInterval = 0;
    }
  }
  advanceGroup(delta) {
    let activeGroup = this.state.activeGroup + delta;
    if (activeGroup < 0) {
      activeGroup += this.props.groups.length;
    }
    activeGroup = activeGroup % this.props.groups.length;
    this.setActiveGroup(activeGroup);
  }
  advanceFrame(delta) {
    let activeFrame = this.state.activeFrame + delta;
    if (activeFrame < 0) {
      activeFrame += this.props.groups[0].length;
    }
    activeFrame = activeFrame % this.props.groups[0].length;
    this.setActiveFrame(activeFrame);
  }
  showActiveFrameToast(activeGroup, activeFrame) {
    let groupName = this.props.groupNames ? this.props.groupNames[activeGroup] : String(activeGroup);
    let config = this.props.groups[activeGroup][activeFrame].config
    if (config.indexOf(DEFAULT_CONFIG) == 0) {
      config = config.substr(DEFAULT_CONFIG.length);
    }
    if (!config) {
      config = "default";
    }
    if (this.props.blind) {
      return;
    }
    this.showToast("Showing Frame: " + groupName + ":" + activeFrame);
  }
  zoom(value) {
    let scale = this.state.scale * value;
    this.setState({scale} as any);
  }
  installKeyboardShortcuts() {
    let playInterval;
    Mousetrap.bind(['`'], (e) => {
      this.setState({showFrameComment: !this.state.showFrameComment} as any);
      e.preventDefault();
    });
    Mousetrap.bind(['enter'], (e) => {
      this.activeGroupScore[this.state.activeFrame][this.getActiveGroupIndex()] = 1;
      this.showToast("Voted. Press ` for results.");
      this.forceUpdate();
      e.preventDefault();
    });
    Mousetrap.bind(['space'], (e) => {
      this.playPause();
      e.preventDefault();
    });
    Mousetrap.bind(['.'], (e) => {
      this.advanceFrame(1);
      e.preventDefault();
    });
    Mousetrap.bind([','], () => {
      this.advanceFrame(-1);
    });
    Mousetrap.bind(['='], (e) => {
      this.advanceGroup(1);
      e.preventDefault();
    });
    Mousetrap.bind(['-'], () => {
      this.advanceGroup(-1);
    });
    Mousetrap.bind([']'], () => {
      this.zoom(2);
    });
    Mousetrap.bind(['['], () => {
      this.zoom(1 / 2);
    });
    Mousetrap.bind(['r'], () => {
      this.resetLayersAndActiveFrame();
    });
    Mousetrap.bind(['tab'], (e) => {
      this.toggleTools();
      e.preventDefault();
    });
    let self = this;
    function toggle(name, event) {
      self.toggleLayer(name);
      event.preventDefault();
    }

    let installedKeys = {};
    for (let name in this.options) {
      let option = this.options[name];
      if (option.key) {
        if (installedKeys[option.key]) {
          console.error("Key: " + option.key + " for " + option.description  + ", is already mapped to " + installedKeys[option.key].description);
        }
        installedKeys[option.key] = option;
        Mousetrap.bind([option.key], toggle.bind(this, name));
      }
    }

    function toggleFrame(i) {
      this.setActiveGroup(i);
    }

    for (let i = 1; i <= this.props.groups.length; i++) {
      Mousetrap.bind([String(i)], toggleFrame.bind(this, i - 1));
    }

  }
  setActiveGroup(activeGroup) {
    this.setState({activeGroup} as any);
    this.showActiveFrameToast(activeGroup, this.state.activeFrame);
  }
  setActiveFrame(activeFrame) {
    this.setState({activeFrame} as any);
    this.showActiveFrameToast(this.getActiveGroupIndex(), activeFrame);
  }
  setActiveGroupAndFrame(activeGroup, activeFrame) {
    this.setState({activeGroup, activeFrame} as any);
    this.showActiveFrameToast(activeGroup, activeFrame);
  }
  toggleTools() {
    if (this.props.blind) {
      return;
    }
    this.setState({showTools: !this.state.showTools} as any);
  }
  resetLayersAndActiveFrame() {
    let o: any = {};
    for (let name in this.options) {
      o[name] = false;
    }
    o.showDecodedImage = true;
    o.activeFrame = 0;
    o.activeGroup = 0;
    this.setState(o as any);
  }
  toggleLayer(name) {
    let o = {};
    o[name] = !this.state[name];
    this.setState(o as any);
  }
  onMouseDown(event: MouseEvent) {
    this.handleMouseEvent(event, true);
  }
  onMouseMove(event: MouseEvent) {
    this.handleMouseEvent(event, false);
  }
  handleMouseEvent(event: MouseEvent, click: boolean) {
    function getMousePosition(canvas: HTMLCanvasElement, event: MouseEvent) {
      let rect = canvas.getBoundingClientRect();
      return new Vector(
        event.clientX - rect.left,
        event.clientY - rect.top
      );
    }
    this.mousePosition = getMousePosition(this.overlayCanvas, event);
    if (click) {
      this.mouseZoomPosition = this.mousePosition;
    }
    this.updateBlockInfo();
  }
  getBlockSize(frame: AnalyzerFrame, c: number, r: number) {
    let blockSize = frame.json["blockSize"];
    if (!blockSize) {
      return undefined;
    }
    if (r >= blockSize.length || r < 0) {
      return undefined;
    }
    if (c >= blockSize[r].length || c < 0) {
      return undefined;
    }
    return blockSize[r][c];
  }
  getParentMIPosition(frame: AnalyzerFrame, v: Vector): Vector {
    let p = this.getMIPosition(frame, v);
    let c = p.x;
    let r = p.y;
    let size = this.getBlockSize(frame, c, r);
    if (size === undefined) {
      return null;
    }
    c = c & ~(((1 << BLOCK_SIZES[size][0]) - 1) >> MI_SIZE_LOG2);
    r = r & ~(((1 << BLOCK_SIZES[size][1]) - 1) >> MI_SIZE_LOG2);
    return new Vector(c, r);
  }
  getParentMIRect(frame: AnalyzerFrame, v: Vector): Rectangle {
    let p = this.getMIPosition(frame, v);
    let c = p.x;
    let r = p.y;
    let size = this.getBlockSize(frame, c, r);
    if (size === undefined) {
      return null;
    }
    c = c & ~(((1 << BLOCK_SIZES[size][0]) - 1) >> MI_SIZE_LOG2);
    r = r & ~(((1 << BLOCK_SIZES[size][1]) - 1) >> MI_SIZE_LOG2);
    return new Rectangle(c << MI_SIZE_LOG2, r << MI_SIZE_LOG2, 1 << BLOCK_SIZES[size][0], 1 << BLOCK_SIZES[size][1]);
  }
  getMIPosition(frame: AnalyzerFrame, v: Vector): Vector {
    let c = (v.x / this.state.scale) >> MI_SIZE_LOG2;
    let r = (v.y / this.state.scale) >> MI_SIZE_LOG2;
    return new Vector(c, r);
  }
  getActiveFrame(): AnalyzerFrame {
    return this.props.groups[this.getActiveGroupIndex()][this.state.activeFrame];
  }
  getActiveGroup(): AnalyzerFrame [] {
    return this.props.groups[this.getActiveGroupIndex()];
  }
  getActiveGroupIndex(): number {
    if (this.state.activeFrame < 0) {
      return 0;
    }
    return this.state.activeGroupMap[this.state.activeFrame][this.state.activeGroup];
  }
  updateBlockInfo() {
    this.forceUpdate();
  }
  getSymbolHist(frames: AnalyzerFrame[]): Histogram [] {
    let data = [];
    let names = Accounting.getSortedSymbolNames(frames.map(frame => frame.accounting));
    frames.forEach((frame, i) => {
      let row = { frame: i, total: 0 };
      let symbols = frame.accounting.createFrameSymbols();
      let total = 0;
      names.forEach(name => {
        let symbol = symbols[name];
        let bits = symbol ? symbol.bits : 0;
        total += bits;
      });
      names.forEach((name, i) => {
        let symbol = symbols[name];
        let bits = symbol ? symbol.bits : 0;
        row[i] = bits;
      });
      data.push(row);
    });
    let nameMap = {};
    names.forEach((name, i) => {
      nameMap[name] = i;
    });
    return data.map(data => new Histogram(data, nameMap));
  }

  onBitsScaleSelect(eventKey: any, event: Object) {
    let showBitsScale = eventKey;
    this.setState({showBitsScale} as any);
  }

  onBitsModeSelect(eventKey: any, event: Object) {
    let showBitsMode = eventKey;
    this.setState({showBitsMode} as any);
  }

  onBitsFilterSelect(eventKey: any, event: Object) {
    let showBitsFilter = eventKey;
    this.setState({showBitsFilter} as any);
  }

  getActiveGroupScore() {
    let s = 0;
    let j = this.getActiveGroupIndex();
    for (let i = 0; i < this.activeGroupScore.length; i++) {
      s += this.activeGroupScore[i][j];
    }
    return s;
  }
  render() {
    let groups = this.props.groups;

    let layerButtons = [];
    for (let name in this.options) {
      let option = this.options[name];
      layerButtons.push(
        <OverlayTrigger placement="top" overlay={<Tooltip>{option.detail} ({option.key})</Tooltip>}>
          { option.icon ?
            <Button bsStyle={this.state[name] ? "primary" : "default"} bsSize="small" onClick={this.toggleLayer.bind(this, name)}><span className={option.icon}></span></Button> :
            <Button bsStyle={this.state[name] ? "primary" : "default"} bsSize="small" onClick={this.toggleLayer.bind(this, name)}>{option.description}</Button>
          }
        </OverlayTrigger>
      );
    }

    let sidePanel = null;
    let frames = this.props.groups[this.getActiveGroupIndex()];
    let frame = this.getActiveFrame();
    if (frame) {
      let names = Accounting.getSortedSymbolNames(frames.map(frame => frame.accounting));
      let accounting = this.getActiveFrame().accounting;
      let layerOptions = [];
      if (this.state.showBits) {
        let names = Accounting.getSortedSymbolNames(frames.map(frame => frame.accounting));
        layerOptions.push(<div>
            <DropdownButton bsSize="small" title="Bits Scale" id="dropdown-size-xsmall" onSelect={this.onBitsScaleSelect.bind(this)}>
              <MenuItem eventKey="frame" active={this.state.showBitsScale == "frame"}>Frame Relative</MenuItem>
              <MenuItem eventKey="video" active={this.state.showBitsScale == "video"}>Video Relative</MenuItem>
              <MenuItem eventKey="videos" active={this.state.showBitsScale == "videos"}>Video Relative (all)</MenuItem>
            </DropdownButton>{' '}
            <DropdownButton bsSize="small" title="Bits Mode" id="dropdown-size-xsmall" onSelect={this.onBitsModeSelect.bind(this)}>
              <MenuItem eventKey="linear" active={this.state.showBitsMode == "linear"}>Single Color</MenuItem>
              <MenuItem eventKey="heat" active={this.state.showBitsMode == "heat"}>Heat Map</MenuItem>
              <MenuItem eventKey="heat-opaque" active={this.state.showBitsMode == "heat-opaque"}>Heat Map (Opaque)</MenuItem>
            </DropdownButton>{' '}
            <DropdownButton bsSize="small" title="Bits Filter" id="dropdown-size-xsmall" onSelect={this.onBitsFilterSelect.bind(this)}>
              <MenuItem eventKey="" active={this.state.showBitsFilter == ""}>None</MenuItem>
              {
                names.map(name => <MenuItem key={name} eventKey={name} active={this.state.showBitsFilter == name}>{name}</MenuItem>)
              }
            </DropdownButton>
          </div>
        );
      }

      let p = this.getParentMIPosition(frame, this.mousePosition);
      sidePanel = <div id="sidePanel">
        <div style={{paddingTop: "4px"}}>
          <ButtonGroup>
            <OverlayTrigger placement="top" overlay={<Tooltip>Toggle Tools: tab</Tooltip>}>
              <Button bsSize="small" onClick={this.toggleTools.bind(this)}><span className="glyphicon glyphicon-th"></span></Button>
            </OverlayTrigger>
            <OverlayTrigger placement="top" overlay={<Tooltip>Repeat: r</Tooltip>}>
              <Button bsSize="small" onClick={this.resetLayersAndActiveFrame.bind(this)}><span className="glyphicon glyphicon-repeat"></span></Button>
            </OverlayTrigger>

            <OverlayTrigger placement="top" overlay={<Tooltip>Previous: ,</Tooltip>}>
              <Button bsSize="small" onClick={this.advanceFrame.bind(this, -1)}><span className="glyphicon glyphicon-step-backward"></span></Button>
            </OverlayTrigger>

            <OverlayTrigger placement="top" overlay={<Tooltip>Pause / Play: space</Tooltip>}>
              <Button bsSize="small" onClick={this.playPause.bind(this)}><span className="glyphicon glyphicon-play"></span></Button>
            </OverlayTrigger>

            <OverlayTrigger placement="top" overlay={<Tooltip>Next: .</Tooltip>}>
              <Button bsSize="small" onClick={this.advanceFrame.bind(this, 1)}><span className="glyphicon glyphicon-step-forward"></span></Button>
            </OverlayTrigger>

            <OverlayTrigger placement="top" overlay={<Tooltip>Zoom Out: [</Tooltip>}>
              <Button bsSize="small" onClick={this.zoom.bind(this, 1 / 2)}><span className="glyphicon glyphicon-zoom-out"></span></Button>
            </OverlayTrigger>

            <OverlayTrigger placement="top" overlay={<Tooltip>Zoom In: ]</Tooltip>}>
              <Button bsSize="small" onClick={this.zoom.bind(this, 2)}><span className="glyphicon glyphicon-zoom-in"></span></Button>
            </OverlayTrigger>
          </ButtonGroup>
        </div>
        <div style={{paddingTop: "4px"}}>
          <ButtonGroup>
            {layerButtons}
          </ButtonGroup>
        </div>

        {layerOptions.length ? <div className="sectionHeader">Layer Options</div> : null}
        {layerOptions}

        <div id="sidePanelScrollArea">
          <div className="sectionHeader">Histograms</div>
          <Tabs defaultActiveKey={2} id="uncontrolled-tab-example" bsStyle="pills">
            <Tab eventKey={1} title="Bits">
              <div className="tabContainer">
                <HistogramComponent histograms={this.getSymbolHist(frames)} highlight={this.state.activeFrame} height={256} width={512} scale="max"></HistogramComponent>
              </div>
            </Tab>
            <Tab eventKey={2} title="Symbols">
              <div className="tabContainer">
                <HistogramComponent histograms={this.getSymbolHist(frames)} highlight={this.state.activeFrame} height={256} width={512}></HistogramComponent>
              </div>
            </Tab>
            <Tab eventKey={3} title="Block Size">
              <div className="tabContainer">
                <HistogramComponent histograms={frames.map(x => x.blockSizeHist)} highlight={this.state.activeFrame} height={256} width={512}></HistogramComponent>
              </div>
            </Tab>
            <Tab eventKey={4} title="Tx Size">
              <div className="tabContainer">
                <HistogramComponent histograms={frames.map(x => x.transformSizeHist)} highlight={this.state.activeFrame} height={256} width={512}></HistogramComponent>
              </div>
            </Tab>
            <Tab eventKey={5} title="Tx Type">
              <div className="tabContainer">
                <HistogramComponent histograms={frames.map(x => x.transformTypeHist)} highlight={this.state.activeFrame} height={256} width={512}></HistogramComponent>
              </div>
            </Tab>
            <Tab eventKey={6} title="Prediction Mode">
              <div className="tabContainer">
                <HistogramComponent histograms={frames.map(x => x.predictionModeHist)} highlight={this.state.activeFrame} height={256} width={512}></HistogramComponent>
              </div>
            </Tab>
            <Tab eventKey={7} title="Skip">
              <div className="tabContainer">
                <HistogramComponent histograms={frames.map(x => x.skipHist)} highlight={this.state.activeFrame} height={256} width={512}></HistogramComponent>
              </div>
            </Tab>
          </Tabs>

          {p &&
            <div>
              <div className="sectionHeader">Block Symbols</div>
              <AccountingComponent symbols={this.getActiveFrame().accounting.createBlockSymbols(p.x, p.y)}></AccountingComponent>
            </div>
          }

          <div className="sectionHeader">Frame Info</div>
          <FrameInfoComponent frame={frame} activeFrame={this.state.activeFrame} activeGroup={this.getActiveGroupIndex()}></FrameInfoComponent>
          {p &&
            <div>
              <div className="sectionHeader">Block Info</div>
              <ModeInfoComponent frame={frame} position={p}></ModeInfoComponent>
            </div>
          }

          <div className="sectionHeader">Frame Symbols</div>
          <AccountingComponent symbols={accounting.frameSymbols}></AccountingComponent>

          <div className="sectionHeader">Build Config</div>
          <div className="propertyValue">{frame.config}</div>

          <div className="sectionHeader">AV1 Analyzer Tips</div>
          <ul>
            <li>Click anywhere on the image to lock focus and get mode info details.</li>
            <li>All analyzer features have keyboard shortcuts, use them.</li>
            <li>Toggle between video sequences by using the number keys: 1, 2, 3, etc.</li>
          </ul>
        </div>
      </div>
    }

    let activeGroup = this.getActiveGroupIndex();
    let groupName = this.props.groupNames ? this.props.groupNames[activeGroup] : String(activeGroup);

    return <div>
      <div className="toast" ref={(self: any) => this.toast = self}>
        Toast
      </div>
      { this.state.showFrameComment &&
        <div id="frameComment">
          <div>
            <div className="sectionHeader">Config</div>
            <div className="propertyValue">{this.getActiveFrame().config}</div>
            <div className="sectionHeader">Video</div>
            <div className="propertyValue">{groupName}</div>
            <div className="sectionHeader">Group</div>
            <div className="propertyValue">{activeGroup} - {this.props.groupNames[activeGroup]}</div>
            <div className="sectionHeader">Score</div>
            <div className="propertyValue">{this.getActiveGroupScore()}</div>
            <div className="sectionHeader">Frame</div>
            <div className="propertyValue">{this.state.activeFrame}</div>
          </div>
        </div>
      }
      <div>
        <canvas ref={(self: any) => this.displayCanvas = self} width="256" height="256" style={{position: "absolute", left: 0, top: 0, zIndex: 0, imageRendering: "pixelated", backgroundCcolor: "#F5F5F5"}}></canvas>
        <canvas ref={(self: any) => this.overlayCanvas = self} width="256" height="256" style={{position: "absolute", left: 0, top: 0, zIndex: 1, imageRendering: "pixelated", cursor: "crosshair"}}></canvas>
      </div>
      { this.state.showTools &&
        <div>
          <div style={{paddingTop: "4px"}}>
            {sidePanel}
          </div>
        </div>
      }
      <div id="zoomContainer" style={{display: this.state.showTools ? "block" : "none"}}>
        <canvas ref={(self: any) => this.zoomCanvas = self} width="256" height="256"></canvas>
      </div>
    </div>
  }

  drawSkip(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let skip = frame.json["skip"];
    let map = frame.json["skipMap"];
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      let v = skip[r][c];
      if (v == map.SKIP) {
        return false;
      }
      ctx.fillStyle = COLORS[map.NO_SKIP];
      return true;
    });
  }
  drawDering(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let dering = frame.json["deringGain"];
    if (!dering) {
      return;
    }
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      let v = dering[r][c];
      if (!v) {
        return false;
      }
      ctx.fillStyle = colorScale(v / 3, HEAT_COLORS);
      return true;
    }, "super-block");
  }
  drawCLPF(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let clpf = frame.json["clpf"];
    if (!clpf) {
      return;
    }
    let strengthY = frame.json["clpfStrengthY"];
    let size = frame.json["clpfSize"];
    if (!size) {
      return;
    }
    // Size 0 means no block signaling, 1 = 32x32, 2 = 64x64, 3 = 128x128.
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      let v = clpf[r][c];
      if (!v || v < 0) {
        return false;
      }
      ctx.fillStyle = colorScale((v * strengthY) / 4, HEAT_COLORS);
      return true;
    }, (CLPF_SIZE_LOG2 - MI_SIZE_LOG2) + (size - 1));
  }
  drawReferenceFrames(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let reference = frame.json["referenceFrame"];
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      let v = reference[r][c][0];
      if (v < 0) {
        return false;
      }
      ctx.fillStyle = COLORS[v];
      return true;
    });
  }
  drawMotionVectors(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let motionVectors = frame.json["motionVectors"];
    let scale = dst.w / src.w;
    let scaledFrameSize = this.frameSize.clone().multiplyScalar(scale);
    ctx.save();
    ctx.globalAlpha = 1;
    let aColor = "red";
    let bColor = "blue";
    ctx.fillStyle = aColor;
    ctx.lineWidth = scale / 2;

    ctx.translate(-src.x * scale, -src.y * scale);
    this.visitBlocks("block", frame, (blockSize, c, r, sc, sr, bounds) => {
      bounds.multiplyScalar(scale);
      let o = bounds.getCenter();
      let m = motionVectors[r][c];
      let a = new Vector(m[0], m[1])
      let b = new Vector(m[2], m[3])

      if (a.length() > 0) {
        ctx.globalAlpha = Math.min(0.3, a.length() / 128);
        ctx.fillStyle = aColor;
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      }

      if (b.length() > 0) {
        ctx.globalAlpha = Math.min(0.3, b.length() / 128);
        ctx.fillStyle = bColor;
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      }

      a.divideScalar(8 / scale);
      let va = o.clone().add(a);
      b.divideScalar(8 / scale);
      let vb = o.clone().add(b);

      // Draw small vectors with a ligher color.
      ctx.globalAlpha = Math.max(0.2, Math.min(a.length() + b.length(), 1));
      ctx.strokeStyle = aColor;
      drawVector(ctx, o, va);

      ctx.strokeStyle = bColor;
      drawVector(ctx, o, vb);

      // Draw Dot
      ctx.beginPath();
      ctx.arc(o.x, o.y, scale / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }
  drawTransformType(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let type = frame.json["transformType"];
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      ctx.fillStyle = COLORS[type[r][c]];
      return true;
    });
  }
  drawBits(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let {blocks, total} = frame.accounting.countBits(this.state.showBitsFilter);
    function getBits(blocks, c, r) {
      if (!blocks[r]) {
        return 0;
      }
      return blocks[r][c] | 0;
    }
    let maxBitsPerPixel = 0;
    if (this.state.showBitsScale == "frame") {
      this.visitBlocks("block", frame, (blockSize, c, r, sc, sr, bounds) => {
        let area = blockSizeArea(blockSize);
        let bits = getBits(blocks, c, r);
        maxBitsPerPixel = Math.max(maxBitsPerPixel, bits / area);
      });
    } else {
      let groups = this.state.showBitsScale === "video" ? [this.getActiveGroup()] : this.props.groups;
      groups.forEach(frames => {
        frames.forEach(frame => {
          let {blocks} = frame.accounting.countBits(this.state.showBitsFilter);
          this.visitBlocks("block", frame, (blockSize, c, r, sc, sr, bounds) => {
            let area = blockSizeArea(blockSize);
            let bits = getBits(blocks, c, r);
            maxBitsPerPixel = Math.max(maxBitsPerPixel, bits / area);
          });
        });
      });
    }
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      let area = blockSizeArea(blockSize);
      let bits = getBits(blocks, c, r);
      let value = (bits / area) / maxBitsPerPixel;
      let mode = this.state.showBitsMode;
      if (mode == "linear") {
        ctx.globalAlpha = value;
        ctx.fillStyle = "#9400D3";
      } else if (mode == "heat") {
        ctx.globalAlpha = value;
        ctx.fillStyle = colorScale(value, HEAT_COLORS);
      } else if (mode == "heat-opaque") {
        ctx.globalAlpha = 1;
        ctx.fillStyle = colorScale(value, HEAT_COLORS);
      }

      return true;
    });
  }
  drawMode(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let mode = frame.json["mode"];
    let modeMap = frame.json["modeMap"];

    const V_PRED = modeMap.V_PRED;
    const H_PRED = modeMap.H_PRED;
    const D45_PRED = modeMap.D45_PRED;
    const D63_PRED = modeMap.D63_PRED;
    const D135_PRED = modeMap.D135_PRED;
    const D117_PRED = modeMap.D117_PRED;
    const D153_PRED = modeMap.D153_PRED;
    const D207_PRED = modeMap.D207_PRED;

    let scale = dst.w / src.w;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "white";
    let lineOffset = getLineOffset(1);
    ctx.translate(lineOffset, lineOffset);
    ctx.translate(-src.x * scale, -src.y * scale);
    let lineWidth = 1;
    ctx.lineWidth = lineWidth;
    this.visitBlocks("block", frame, (blockSize, c, r, sc, sr, bounds) => {
      bounds.multiplyScalar(scale);
      drawMode(mode[r][c], bounds);
    });

    function drawMode(m: number, bounds: Rectangle) {
      let x = bounds.x;
      let y = bounds.y;
      let w = bounds.w;
      let h = bounds.h;
      let hw = w / 2;
      let hh = h / 2;
      switch (m) {
        case V_PRED:
          drawLine(ctx, x + hw + lineOffset, y, 0, h);
          break;
        case H_PRED:
          drawLine(ctx, x, y + hh + lineOffset, w, 0);
          break;
        case D45_PRED:
          drawLine(ctx, x, y + h, w, -h);
          break;
        case D63_PRED:
          drawLine(ctx, x, y + h, hw, -h);
          break;
        case D135_PRED:
          drawLine(ctx, x, y, w, h);
          break;
        case D117_PRED:
          drawLine(ctx, x + hw, y, hw, h);
          break;
        case D153_PRED:
          drawLine(ctx, x, y + hh, w, hh);
          break;
        case D207_PRED:
          drawLine(ctx, x, y + hh, w, -hh);
          break;
        default:
          ctx.fillStyle = COLORS[m];
          ctx.fillRect(x, y, w, h);
          break;
      }
    }
    ctx.restore();
  }
  drawFillBlock(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle, setFillStyle: (blockSize, c, r, sc, sr) => boolean, mode: string | number = "block") {
    let scale = dst.w / src.w;
    ctx.save();
    ctx.translate(-src.x * scale, -src.y * scale);
    this.visitBlocks(mode, frame, (blockSize, c, r, sc, sr, bounds) => {
      bounds.multiplyScalar(scale);
      setFillStyle(blockSize, c, r, sc, sr) && ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    });
    ctx.restore();
  }

  visitBlocks(mode: string | number, frame: AnalyzerFrame, visitor: BlockVisitor) {
    let blockSize = frame.json["blockSize"];
    let blockSizeMap = frame.json["blockSizeMap"];

    let transformSize = frame.json["transformSize"];
    let transformSizeMap = frame.json["transformSizeMap"];

    var bounds = new Rectangle(0, 0, 0, 0);
    let rows = blockSize.length;
    let cols = blockSize[0].length;
    let S = MI_SIZE;

    if (typeof mode === "number") {
      for (let c = 0; c < cols; c += 1 << mode) {
        for (let r = 0; r < rows; r += 1 << mode) {
          let size = blockSize[r][c];
          visitor(size, c, r, 0, 0, bounds.set(c * S, r * S, MI_SIZE << mode, MI_SIZE << mode));
        }
      }
    } else if (mode === "super-block") {
      for (let c = 0; c < cols; c += SUPER_MI_SIZE / MI_SIZE) {
        for (let r = 0; r < rows; r += SUPER_MI_SIZE / MI_SIZE) {
          let size = blockSize[r][c];
          visitor(size, c, r, 0, 0, bounds.set(c * S, r * S, SUPER_MI_SIZE, SUPER_MI_SIZE));
        }
      }
    } else if (mode === "block") {
      /**
       * Maps AnalyzerBlockSize enum to [w, h] log2 pairs.
       */
      // Visit blocks >= 8x8
      for (let i = 3; i < BLOCK_SIZES.length; i++) {
        let dc = 1 << (BLOCK_SIZES[i][0] - 3);
        let dr = 1 << (BLOCK_SIZES[i][1] - 3);
        for (let c = 0; c < cols; c += dc) {
          for (let r = 0; r < rows; r += dr) {
            let size = blockSize[r][c];
            let w = (1 << BLOCK_SIZES[size][0]);
            let h = (1 << BLOCK_SIZES[size][1]);
            if (size == i) {
              visitor(size, c, r, 0, 0, bounds.set(c * S, r * S, w, h));
            }
          }
        }
      }

      // Visit blocks < 8x8.
      const BLOCK_4X4 = blockSizeMap.BLOCK_4X4;
      const BLOCK_8X4 = blockSizeMap.BLOCK_8X4;
      const BLOCK_4X8 = blockSizeMap.BLOCK_4X8;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          let size = blockSize[r][c];
          let w = (1 << BLOCK_SIZES[size][0]);
          let h = (1 << BLOCK_SIZES[size][1]);
          switch (size) {
            case BLOCK_4X4:
              visitor(size, c, r, 0, 0, bounds.set(c * S,     r * S,     w, h));
              visitor(size, c, r, 0, 1, bounds.set(c * S,     r * S + h, w, h));
              visitor(size, c, r, 1, 0, bounds.set(c * S + w, r * S,     w, h));
              visitor(size, c, r, 1, 1, bounds.set(c * S + w, r * S + h, w, h));
              break;
            case BLOCK_8X4:
              visitor(size, c, r, 0, 0, bounds.set(c * S,     r * S,     w, h));
              visitor(size, c, r, 0, 1, bounds.set(c * S,     r * S + h, w, h));
              break;
            case BLOCK_4X8:
              visitor(size, c, r, 0, 0, bounds.set(c * S,     r * S,     w, h));
              visitor(size, c, r, 1, 0, bounds.set(c * S + w, r * S,     w, h));
              break;
          }
        }
      }
    } else if (mode === "transform") {
      // Some code duplication here, to keep things simple.

      /**
       * Maps AnalyzerTransformSize enum to [w, h] log2 pairs.
       */
      const TRANSFORM_SIZES = [
        [2, 2],
        [3, 3],
        [4, 4],
        [5, 5]
      ];

      // Visit blocks >= 8x8.
      for (let i = 1; i < TRANSFORM_SIZES.length; i++) {
        let dc = 1 << (TRANSFORM_SIZES[i][0] - 3);
        let dr = 1 << (TRANSFORM_SIZES[i][1] - 3);
        for (let c = 0; c < cols; c += dc) {
          for (let r = 0; r < rows; r += dr) {
            let size = transformSize[r][c];
            let w = (1 << TRANSFORM_SIZES[size][0]);
            let h = (1 << TRANSFORM_SIZES[size][1]);
            if (size == i) {
              visitor(size, c, r, 0, 0, bounds.set(c * S, r * S, w, h));
            }
          }
        }
      }
      const TX_4X4 = transformSizeMap.TX_4X4;
      // Visit blocks < 4x4.
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          let size = transformSize[r][c];
          if (size != 0) {
            continue;
          }
          let w = (1 << TRANSFORM_SIZES[size][0]);
          let h = (1 << TRANSFORM_SIZES[size][1]);
          switch (size) {
            case TX_4X4:
              visitor(size, c, r, 0, 0, bounds.set(c * S,     r * S,     w, h));
              visitor(size, c, r, 0, 1, bounds.set(c * S,     r * S + h, w, h));
              visitor(size, c, r, 1, 0, bounds.set(c * S + w, r * S,     w, h));
              visitor(size, c, r, 1, 1, bounds.set(c * S + w, r * S + h, w, h));
              break;
          }
        }
      }
    } else {
      throw new Error("Can't handle mode: " + mode);
    }
  }
}

interface AnalyzerViewCompareComponentProps {
  decoderVideoUrlPairs: {decoderUrl: string, videoUrl: string, decoderName: string} [];
  playbackFrameRate?: number;
  layers?: number;
  maxFrames?: number;
  blind?: number;
}

export class AnalyzerViewCompareComponent extends React.Component<AnalyzerViewCompareComponentProps, {
  frames: AnalyzerFrame [][],
  groupNames: string [],
  analyzerFailedToLoad: boolean,
  decodedFrameCount: number,
  loading: "done" | "failed" | "loading",
  status: string
}> {
  public static defaultProps: AnalyzerViewCompareComponentProps = {
    decoderVideoUrlPairs: [],
    playbackFrameRate: 30,
    maxFrames: MAX_FRAMES,
    layers: 0xFFFFFFFF
  };
  constructor() {
    super();
    this.state = {
      frames: [],
      groupNames: null,
      decodedFrameCount: 0,
      analyzerFailedToLoad: null,
      loading: "loading",
      status: ""
    } as any;
  }
  componentWillMount() {
    let decoderUrls = [];
    let decoderNames = [];
    let videoUrls = [];
    this.props.decoderVideoUrlPairs.forEach(pair => {
      decoderUrls.push(pair.decoderUrl);
      decoderNames.push(pair.decoderName);
      videoUrls.push(pair.videoUrl);
    });
    this.load(decoderUrls, decoderNames, videoUrls);
  }
  load(decoderPaths: string[], decoderNames: string[], videoPaths: string[]) {
    this.setState({ status: "Loading Decoders" } as any);
    Promise.all(decoderPaths.map(path => Decoder.loadDecoder(path))).then(decoders => {
      console.info(decoders);
      this.setState({ status: "Downloading Files" } as any);
      Promise.all(videoPaths.map(path => downloadFile(path))).then(bytes => {
        console.info(bytes);
        let decodedFrames = [];
        for (let i = 0; i < decoders.length; i++) {
          let decoder = decoders[i];
          decoder.openFileBytes(bytes[i]);
        }
        let groupNames = decoderNames.slice();
        for (let i = 0; i < decoderPaths.length; i++) {
          if (groupNames[i]) {
            continue;
          }
          let videoPath = videoPaths[i];
          let j = videoPath.lastIndexOf("/");
          if (j >= 0) {
            videoPath = videoPath.substring(j + 1);
          }
          groupNames[i] = videoPath;
        }
        this.setState({ status: "Decoding Frames" } as any);
        Promise.all(decoders.map(decoder => this.decodeFrames(decoder, this.props.maxFrames))).then(frames => {
          this.setState({ frames: frames, groupNames: groupNames, loading: "done" } as any);
        });
      }).catch(e => {
        this.setState({ status: "Downloading Files Failed", loading: "error" } as any);
      });
    }).catch(e => {
      this.setState({ status: `Loading Decoders Failed: ${e}`, loading: "error" } as any);
    });
  }

  decodedFrameCount = 0;
  decodeFrames(deocder: Decoder, count: number): Promise<AnalyzerFrame[]>  {
    return new Promise((resolve, reject) => {
      let time = performance.now();
      let decodedFrames = [];
      let interval = setInterval(() => {
        deocder.setLayers(this.props.layers);
        deocder.readFrame().then((frames) => {
          this.setState({ status: `Decoded ${this.decodedFrameCount} Frames ...` } as any);
          if (!frames) {
            clearInterval(interval);
            resolve(decodedFrames);
            return;
          }
          frames.forEach(frame => {
            decodedFrames.push(frame);
          });
          this.decodedFrameCount += frames.length;
          if (--count <= 0) {
            clearInterval(interval);
            console.info(`Decode Time: ${performance.now() - time}`);
            resolve(decodedFrames);
          }
        });
      }, 16);
    });
  }
  render() {
    let frames = this.state.frames;
    if (this.state.loading != "done") {
      let icon = this.state.loading === "loading" ? <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> : <span className="glyphicon glyphicon-ban-circle"></span>;
      return <div className="panel">
        <span>{icon} {this.state.status}</span>
      </div>
    }

    return <div>
      <AnalyzerView groups={this.state.frames} groupNames={this.state.groupNames} playbackFrameRate={this.props.playbackFrameRate} blind={this.props.blind}></AnalyzerView>
    </div>;
  }
}

export class LocalAnalyzerComponent extends React.Component<{

}, {
  show: boolean;
  group: {decoderUrl: string, videoUrl: string, name: string, decoderName: string} [][]
}> {
  constructor() {
    super();
    this.state = {
      show: false,
      group: [[], [], []]
    } as any;
  }
  onDrop(i, ev) {
    ev.preventDefault();
    function readFile(item) {
      return new Promise((resolve, reject) => {
        if (item.kind == "file") {
          let file = item.getAsFile();
          let localName = i + "_" + file.name;
          console.log("Loading: " + file.name);
          let reader = new FileReader();
          reader.onload = function() {
            let result;
            if (typeof reader.result == "string") {
              result = reader.result;
            } else {
              result = new Uint8Array(reader.result);
            }
            localFiles[localName] = result;
          };
          if (file.type === "text/javascript") {
            reader.readAsText(file);
          } else {
            reader.readAsArrayBuffer(file);
          }
          resolve({
            name: file.name,
            localName: localName,
            type: file.type || "video/ivf"
          });
        } else {
          reject();
        }
      });
    }
    var dt = ev.dataTransfer;
    if (dt.items) {
      let currenDecoder = null;
      let items = [];
      for (let i = 0; i < dt.items.length; i++) {
        items.push(dt.items[i]);
      }
      let group = this.state.group;
      group[i] = [];
      Promise.all(items.map(item => readFile(item))).then(files => {
        let decoder = files.find((file: any) => file.type == "text/javascript") as any;
        if (!decoder) {
          alert("Drag at least one decoder.js file.");
          return;
        }
        files.forEach((file: any) => {
          if (file.type == "text/javascript") {
            return;
          }
          group[i].push({
            decoderUrl: localFileProtocol + decoder.localName,
            videoUrl: localFileProtocol + file.localName,
            name: "(" + file.name + ", " + decoder.name + ")",
            decoderName: ""
          });
        });
        if (group[i].length == 0) {
          alert("Drag at least one .ivf file.");
          return;
        }
        this.setState({group} as any);
      });
    } else {
      throw new Error("Can't read files.");
    }
  }
  onDragOver(ev) {
    ev.preventDefault();
  }
  onDragEnd() {
    console.info("drag end");
  }
  analyze() {
    this.setState({show: true} as any);
  }
  render() {
    let group = this.state.group;
    let pairs = group[0].concat(group[1]).concat(group[2]);
    if (this.state.show) {
      return <AnalyzerViewCompareComponent
        decoderVideoUrlPairs={pairs}
      />
    }
    return <div className="panel">
      <div style={{float: "left"}} className="dropPanel" onDrop={this.onDrop.bind(this, 0)} onDragOver={this.onDragOver.bind(this)} onDragEnd={this.onDragEnd.bind(this)}>
        {
          group[0].length ?
            group[0].map(pair => pair.name).join(", ")
            : <strong>Drag and drop a decoder and one or more video files ...</strong>
        }
      </div>
      <div style={{float: "left"}} className="dropPanel" onDrop={this.onDrop.bind(this, 1)} onDragOver={this.onDragOver.bind(this)} onDragEnd={this.onDragEnd.bind(this)}>
        {
          group[1].length ?
            group[1].map(pair => pair.name).join(", ")
            : <strong>Drag and drop a decoder and one or more video files ...</strong>
        }
      </div>
      <div style={{float: "left"}} className="dropPanel" onDrop={this.onDrop.bind(this, 2)} onDragOver={this.onDragOver.bind(this)} onDragEnd={this.onDragEnd.bind(this)}>
        {
          group[2].length ?
            group[2].map(pair => pair.name).join(", ")
            : <strong>Drag and drop a decoder and one or more video files ...</strong>
        }
      </div>
      <div style={{clear: "left", paddingTop: "8px"}}>
        <Button onClick={this.analyze.bind(this)} disabled={pairs.length == 0} >Analyze</Button>
      </div>
    </div>
  }
}