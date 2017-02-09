import * as React from "react";
import { OverlayTrigger, Tooltip, ButtonGroup, Pagination, Button, Panel, Form, FormGroup, ControlLabel, FormControl, ButtonToolbar, Glyphicon } from "react-bootstrap";
import { } from "react-bootstrap";
import { appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile, fileExists, analyzerBaseUrl, baseUrl } from "../stores/Stores";
import { Decoder, Rectangle, Size, AnalyzerFrame, loadFramesFromJson, downloadFile, Histogram, Accounting, AccountingSymbolMap, clamp, Vector } from "../analyzer";
import { Promise } from "es6-promise";

import { BarPlot, BarPlotTable, Data } from "./Plot";
declare var d3;
declare var Mousetrap;

const DEFAULT_MARGIN = { top: 10, right: 10, bottom: 20, left: 40 };
const MAX_FRAMES = 128;
const MI_SIZE_LOG2 = 3;
const MI_SIZE = 1 << MI_SIZE_LOG2;
const ZOOM_WIDTH = 384;
const ZOOM_SOURCE = 64;

const COLORS = [
  "#E85EBE", "#009BFF", "#00FF00", "#0000FF", "#FF0000", "#01FFFE", "#FFA6FE",
  "#FFDB66", "#006401", "#010067", "#95003A", "#007DB5", "#FF00F6", "#FFEEE8",
  "#774D00", "#90FB92", "#0076FF", "#D5FF00", "#FF937E", "#6A826C", "#FF029D",
  "#FE8900", "#7A4782", "#7E2DD2", "#85A900", "#FF0056", "#A42400", "#00AE7E",
  "#683D3B", "#BDC6FF", "#263400", "#BDD393", "#00B917", "#9E008E", "#001544",
  "#C28C9F", "#FF74A3", "#01D0FF", "#004754", "#E56FFE", "#788231", "#0E4CA1",
  "#91D0CB", "#BE9970", "#968AE8", "#BB8800", "#43002C", "#DEFF74", "#00FFC6",
  "#FFE502", "#620E00", "#008F9C", "#98FF52", "#7544B1", "#B500FF", "#00FF78",
  "#FF6E41", "#005F39", "#6B6882", "#5FAD4E", "#A75740", "#A5FFD2", "#FFB167"
];

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
  frames: AnalyzerFrame[][],
  groupNames?: string[],
  playbackFrameRate?: number;
}

export class HistogramComponent extends React.Component<{
  histograms: Histogram[];
  highlight?: number;
  height?: number;
}, {

}> {
  public static defaultProps = {
    height: 128
  };
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  ratio: number;
  w: number;
  h: number;
  constructor() {
    super();
    this.ratio = window.devicePixelRatio || 1;
  }
  componentDidUpdate(prevProps, prevState) {
    this.renderHistogram(this.context, this.props.histograms);
  }
  componentDidMount() {
    let w = this.w = 360;
    let h = this.h = this.props.height;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.canvas.width = w * this.ratio;
    this.canvas.height = h * this.ratio;
    this.context = this.canvas.getContext("2d");
    this.renderHistogram(this.context, this.props.histograms);
  }
  renderHistogram(ctx: CanvasRenderingContext2D, histograms: Histogram[]) {
    let names = null;
    if (histograms.length) {
      if (!histograms[0]) {
        return;
      }
      names = histograms[0].names;
    }
    if (!names) {
      let max = 0;
      histograms.forEach(histogram => {
        for (var name in histogram.counts) {
          max = Math.max(max, parseInt(name, 10));
        }
      });
      names = [];
      for (let i = 0; i <= max; i++) {
        names.push(i);
      }
    }
    function valueOf(histogram, name) {
      let counts = histogram.counts;
      return counts[name] === undefined ? 0 : counts[name];
    }
    let rows = [];
    histograms.forEach((histogram: Histogram, i) => {
      let row = { frame: i, total: 0 };
      let total = 0;
      names.forEach((name, i) => {
        total += valueOf(histogram, i);
      });
      names.forEach((name, i) => {
        row[name] = valueOf(histogram, i) / total;
      });
      rows.push(row);
    });
    this.renderChart(ctx, names, rows);
    return;
  }

  renderChart(ctx: CanvasRenderingContext2D, names: string[], data: any[], yDomain = [0, 1]) {
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let r = this.ratio;
    let w = this.w * r;
    let lw = 8 * r;
    let tw = 64 * r; // Max Text Width
    let h = this.h * r;
    let bw = Math.min(16 * r, (w - lw - tw) / data.length | 0);
    for (let i = 0; i < data.length; i++) {
      let t = 0;
      names.forEach((k, j) => {
        let v = data[i][k];
        ctx.fillStyle = COLORS[j];
        ctx.fillRect(i * bw, t * h | 0, bw - 1, v * h | 0);
        t += v;
      });
      if (this.props.highlight == i) {
        ctx.fillStyle = "white";
        ctx.fillRect(i * bw, 0, bw - 1, r * 2);
      }
    }

    // Legend

    let lh = 8 * r;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = (10 * r) + "px Arial";
    for (let i = 0; i < names.length; i++) {
      ctx.fillStyle = COLORS[i];
      ctx.fillRect(w - lw, i * (lh + 2 * r), lw, lh);
      ctx.fillStyle = "white";
      ctx.fillText(names[i], w - lw - 2 * r, i * (lh + 2 * r) + (lh / 2));
    }
    ctx.restore();
  }

  render() {
    return  <div id="c" className="chartParent">
      <canvas ref={(self: any) => this.canvas = self} width="256" height="256"></canvas>
    </div>
  }
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

    return <div>
      <table className="symbolTable">
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
    return <div>
      <div style={{float: "left", width: "40%"}}>
        <div><span className="propertyName">Video:</span> <span className="propertyValue">{this.props.activeGroup}</span></div>
        <div><span className="propertyName">Frame:</span> <span className="propertyValue">{this.props.activeFrame}</span></div>
        <div><span className="propertyName">Frame Type:</span> <span className="propertyValue">{frame.json.frameType}</span></div>
        <div><span className="propertyName">Show Frame:</span> <span className="propertyValue">{frame.json.showFrame}</span></div>
      </div>
      <div style={{float: "left", width: "60%"}}>
        <div><span className="propertyName">BaseQIndex:</span> <span className="propertyValue">{frame.json.baseQIndex}</span></div>
        <div><span className="propertyName">Frame Size:</span> <span className="propertyValue">{frame.imageData.width} x {frame.imageData.height}</span></div>
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
      return json[name + "Map"][v];
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
      let a = v[0] >= 0 ? ((map && map[v[0]] !== undefined) ? map[v[0]] : v[0]) : "N/A";
      let b = v[1] >= 0 ? ((map && map[v[1]] !== undefined) ? map[v[1]] : v[1]) : "N/A";
      return `${a}, ${b}`;
    }
    return <div>
      <div style={{float: "left", width: "40%"}}>
        <div><span className="propertyName">Block:</span> <span className="propertyValue">{c}x{r}</span></div>
        <div><span className="propertyName">Block Size:</span> <span className="propertyValue">{getProperty("blockSize")}</span></div>
        <div><span className="propertyName">Transform Size:</span> <span className="propertyValue">{getProperty("transformSize")}</span></div>
        <div><span className="propertyName">Transform Type:</span> <span className="propertyValue">{getProperty("transformType")}</span></div>
      </div>
      <div style={{float: "left", width: "60%"}}>
        <div><span className="propertyName">Mode:</span> <span className="propertyValue">{getProperty("mode")}</span></div>
        <div><span className="propertyName">Skip:</span> <span className="propertyValue">{getProperty("skip")}</span></div>
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
    showTransformGrid: boolean;
    showSkip: boolean;
    showMode: boolean;
    showBits: boolean;
    showTransformType: boolean;
    showTools: boolean;
  }> {
  public static defaultProps: AnalyzerViewProps = {
    frames: [],
    groupNames: null,
    playbackFrameRate: 30
  };

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
  container: HTMLDivElement = null;

  toast: HTMLDivElement;
  toastTimeout: any;
  mousePosition: Vector;

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
      value: undefined
    },
    // showPredictedImage: {
    //   key: "p",
    //   description: "Predicted Image",
    //   detail: "Display the predicted image, or the residual if the decoded image is displayed.",
    //   updatesImage: true,
    //   default: false,
    //   value: undefined
    // },
    // showSuperBlockGrid: {
    //   key: "g",
    //   description: "SB Grid",
    //   detail: "Display the 64x64 super block grid.",
    //   default: false,
    //   value: undefined
    // },
    // showTileGrid: {
    //   key: "l",
    //   description: "Tile Grid",
    //   detail: "Display tile grid.",
    //   default: false,
    //   value: undefined
    // },
    showTransformGrid: {
      key: "t",
      description: "Transform Grid",
      detail: "Display transform blocks.",
      default: false,
      value: undefined
    },
    showTransformType: {
      key: "g",
      description: "Transform Type",
      detail: "Display transform type.",
      default: false,
      value: undefined
    },
    showBlockGrid: {
      key: "s",
      description: "Split Grid",
      detail: "Display block partitions.",
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
      value: undefined
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
  constructor() {
    super();
    let ratio = window.devicePixelRatio || 1;
    this.state = {
      activeFrame: -1,
      activeGroup: 0,
      scale: 1,
      showBlockGrid: false,
      showTransformGrid: false,
      showSkip: false,
      showMode: false,
      showBits: false,
      showDecodedImage: true,
      showMotionVectors: false,
      showReferenceFrames: false,
      showTools: true
    } as any;
    this.ratio = ratio;
    this.frameCanvas = document.createElement("canvas");
    this.frameContext = this.frameCanvas.getContext("2d");
    this.compositionCanvas = document.createElement("canvas");
    this.compositionContext = this.compositionCanvas.getContext("2d");
    this.mousePosition = new Vector(128, 128);
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
    console.log(message);
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
    let frame = this.props.frames[group][index];
    this.frameContext.putImageData(frame.imageData, 0, 0);

    // Draw frameCanvas to displayCanvas
    (this.displayContext as any).imageSmoothingEnabled = false;
    this.displayContext.mozImageSmoothingEnabled = false;
    let dw = this.frameSize.w * this.state.scale * this.ratio;
    let dh = this.frameSize.h * this.state.scale * this.ratio;
    if (this.state.showDecodedImage) {
      this.displayContext.drawImage(this.frameCanvas, 0, 0, dw, dh);
    } else {
      this.displayContext.fillStyle = "gray";
      this.displayContext.fillRect(0, 0, dw, dh);
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
      ctx.strokeRect(this.mousePosition.x * ratio - w / 2,
                     this.mousePosition.y * ratio - w / 2, w, w);
      ctx.restore();
    }
  }
  drawZoom(group: number, index: number) {
    let frame = this.props.frames[group][index];
    let mousePosition = this.mousePosition.clone().divideScalar(this.state.scale).snap();
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
    this.state.showTransformType && this.drawTransformType(frame, ctx, src, dst);
    this.state.showMotionVectors && this.drawMotionVectors(frame, ctx, src, dst);
    this.state.showReferenceFrames && this.drawReferenceFrames(frame, ctx, src, dst);
    ctx.globalAlpha = 1;
    this.state.showTransformGrid && this.drawGrid(frame, "transform", "yellow", ctx, src, dst);
    this.state.showBlockGrid && this.drawGrid(frame, "block", "white", ctx, src, dst);
    ctx.restore();

  }
  drawGrid(frame: AnalyzerFrame, mode: string, color: string, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let scale = dst.w / src.w;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    let lineOffset = getLineOffset(1);
    ctx.translate(lineOffset, lineOffset);
    ctx.translate(-src.x * scale, -src.y * scale);
    let lineWidth = 1;
    ctx.lineWidth = lineWidth;
    this.visitBlocks(mode, frame, (blockSize, c, r, sc, sr, bounds) => {
      bounds.multiplyScalar(scale);
      drawSplit(ctx, bounds.x, bounds.y, bounds.w, bounds.h);
    });
    ctx.restore();
  }
  componentDidMount() {
    if (!this.props.frames.length)
      return;
    this.reset();
    this.installKeyboardShortcuts();
    this.advanceFrame(1);

    this.overlayCanvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.overlayCanvas.addEventListener("mousedown", this.onMouseDown.bind(this));
  }
  componentDidUpdate(prevProps, prevState) {
    let imageData = this.props.frames[this.state.activeGroup][0].imageData;
    let frameSizeChanged = this.frameSize.w !== imageData.width || this.frameSize.h != imageData.height;
    if (this.state.scale != prevState.scale || frameSizeChanged) {
      this.reset();
    }
    if (this.state.activeFrame >= 0) {
      this.draw(this.state.activeGroup, this.state.activeFrame);
      this.drawZoom(this.state.activeGroup, this.state.activeFrame);
    }
  }
  reset() {
    let imageData = this.props.frames[this.state.activeGroup][0].imageData;
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
      activeGroup += this.props.frames.length;
    }
    activeGroup = activeGroup % this.props.frames.length;
    this.setActiveGroup(activeGroup);
  }
  advanceFrame(delta) {
    let activeFrame = this.state.activeFrame + delta;
    if (activeFrame < 0) {
      activeFrame += this.props.frames[0].length;
    }
    activeFrame = activeFrame % this.props.frames[0].length;
    this.setActiveFrame(activeFrame);
  }
  showActiveFrameToast(activeGroup, activeFrame) {
    let groupName = this.props.groupNames ? this.props.groupNames[activeGroup] : String(activeGroup);
    this.showToast("Showing Frame: " + groupName + " : " + activeFrame);
  }
  zoom(value) {
    let scale = this.state.scale * value;
    this.setState({scale} as any);
  }
  installKeyboardShortcuts() {
    let playInterval;
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

    for (let i = 1; i <= this.props.frames.length; i++) {
      Mousetrap.bind([String(i)], toggleFrame.bind(this, i - 1));
    }

  }
  setActiveGroup(activeGroup) {
    this.setState({activeGroup} as any);
    this.showActiveFrameToast(activeGroup, this.state.activeFrame);
  }
  setActiveFrame(activeFrame) {
    this.setState({activeFrame} as any);
    this.showActiveFrameToast(this.state.activeGroup, activeFrame);
  }
  setActiveGroupAndFrame(activeGroup, activeFrame) {
    this.setState({activeGroup, activeFrame} as any);
    this.showActiveFrameToast(activeGroup, activeFrame);
  }
  toggleTools() {
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
    this.handleMouseEvent(event);
  }
  onMouseMove(event: MouseEvent) {
    // this.handleMouseEvent(event);
  }
  handleMouseEvent(event: MouseEvent) {
    function getMousePosition(canvas: HTMLCanvasElement, event: MouseEvent) {
      let rect = canvas.getBoundingClientRect();
      return new Vector(
        event.clientX - rect.left,
        event.clientY - rect.top
      );
    }
    this.mousePosition = getMousePosition(this.overlayCanvas, event);
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
  getMIPosition(frame: AnalyzerFrame, v: Vector): Vector {
    let c = (v.x / this.state.scale) >> MI_SIZE_LOG2;
    let r = (v.y / this.state.scale) >> MI_SIZE_LOG2;
    return new Vector(c, r);
  }
  getActiveFrame(): AnalyzerFrame {
    return this.props.frames[this.state.activeGroup][this.state.activeFrame];
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
        row[i] = bits / total;
      });
      data.push(row);
    });
    return data.map(data => new Histogram(data, names));
  }

  render() {
    let groups = this.props.frames;

    let layerButtons = [];
    for (let name in this.options) {
      let option = this.options[name];
      layerButtons.push(
        <OverlayTrigger placement="top" overlay={<Tooltip>{option.detail} ({option.key})</Tooltip>}>
          <Button bsStyle={this.state[name] ? "primary" : "default"} bsSize="xsmall" onClick={this.toggleLayer.bind(this, name)}>{option.description}</Button>
        </OverlayTrigger>
      );
    }

    let blockInfo = null;
    let frame = this.getActiveFrame();
    if (frame) {
      let frames = this.props.frames[this.state.activeGroup];
      let names = Accounting.getSortedSymbolNames(frames.map(frame => frame.accounting));
      let accounting = this.getActiveFrame().accounting;

      let json = frame.json;
      let p = this.getParentMIPosition(frame, this.mousePosition);

      if (p) {
        let symbolHist = this.getSymbolHist(frames);
        let blockSymbols = this.getActiveFrame().accounting.createBlockSymbols(p.x, p.y);

        blockInfo = <div className="sidePanel">

          <div className="sectionHeader">Frame Info</div>
          <FrameInfoComponent frame={frame} activeFrame={this.state.activeFrame} activeGroup={this.state.activeGroup}></FrameInfoComponent>

          <div className="sectionHeader">Block Info</div>
          <ModeInfoComponent frame={frame} position={p}></ModeInfoComponent>

          <div className="sectionHeader">Symbols</div>
          <HistogramComponent histograms={symbolHist} highlight={this.state.activeFrame} height={256}></HistogramComponent>

          <div className="sectionHeader">Block Size</div>
          <HistogramComponent histograms={frames.map(x => x.blockSizeHist)} highlight={this.state.activeFrame} height={256}></HistogramComponent>

          <div className="sectionHeader">Transform Size</div>
          <HistogramComponent histograms={frames.map(x => x.transformSizeHist)} highlight={this.state.activeFrame} height={256}></HistogramComponent>

          <div className="sectionHeader">Transform Type</div>
          <HistogramComponent histograms={frames.map(x => x.transformTypeHist)} highlight={this.state.activeFrame} height={64}></HistogramComponent>

          <div className="sectionHeader">Prediction Mode</div>
          <HistogramComponent histograms={frames.map(x => x.predictionModeHist)} highlight={this.state.activeFrame} height={256}></HistogramComponent>

          <div className="sectionHeader">Skip Mode</div>
          <HistogramComponent histograms={frames.map(x => x.skipHist)} highlight={this.state.activeFrame} height={32}></HistogramComponent>

          <div className="sectionHeader">Block Symbols</div>
          <AccountingComponent symbols={blockSymbols}></AccountingComponent>

          <div className="sectionHeader">Frame Symbols</div>
          <AccountingComponent symbols={accounting.frameSymbols}></AccountingComponent>

          <div className="sectionHeader">AV1 Analyzer Tips</div>
          <ul>
            <li>Click anywhere on the image to lock focus and get mode info details.</li>
            <li>All analyzer features have keyboard shortcuts, use them.</li>
            <li>Toggle between video sequences by using the number keys: 1, 2, 3, etc.</li>
          </ul>
        </div>
      }
    }

    console.log("Render");
    let toolbox = null;
    if (this.state.showTools) {
      toolbox = <div className="toolbox" style={{padding: "10px"}}>
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
        <div className="propertyContainer" style={{paddingTop: "4px"}}>
          {blockInfo}
        </div>
      </div>
    }

    return <div>
      <div className="toast" ref={(self: any) => this.toast = self}>
        Toast
      </div>
      <div ref={(self: any) => this.container = self}>
        <canvas ref={(self: any) => this.displayCanvas = self} width="256" height="256" style={{position: "absolute", left: 0, top: 0, zIndex: 0, imageRendering: "pixelated", backgroundCcolor: "#F5F5F5"}}></canvas>
        <canvas ref={(self: any) => this.overlayCanvas = self} width="256" height="256" style={{position: "absolute", left: 0, top: 0, zIndex: 1, imageRendering: "pixelated", cursor: "crosshair"}}></canvas>
      </div>
      {toolbox}
      <div className="zoomPanel" style={{display: this.state.showTools ? "block" : "none"}}>
        <canvas ref={(self: any) => this.zoomCanvas = self} width="256" height="256"></canvas>
      </div>
    </div>
  }

  drawSkip(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let skip = frame.json["skip"];
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      let v = skip[r][c];
      if (!v) {
        return false;
      }
      ctx.fillStyle = COLORS[v];
      return true;
    });
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
    let {blocks, total} = frame.accounting.countBits();
    // TODO: Tweak this max value. If it's not a constant then we can't compare different frames and/or vidoes.
    let maxBitsPerPixel = 16;
    this.drawFillBlock(frame, ctx, src, dst, (blockSize, c, r, sc, sr) => {
      let area = blockSizeArea(blockSize);
      let bits = blocks[r][c] | 0;
      ctx.globalAlpha = (bits / area) / maxBitsPerPixel;
      ctx.fillStyle = "#9400D3";
      return true;
    });
  }
  drawMode(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let mode = frame.json["mode"];
    let modeMap = frame.json["modeMap"];

    const V_PRED = modeMap.indexOf("V_PRED");
    const H_PRED = modeMap.indexOf("H_PRED");
    const D45_PRED = modeMap.indexOf("D45_PRED");
    const D63_PRED = modeMap.indexOf("D63_PRED");
    const D135_PRED = modeMap.indexOf("D135_PRED");
    const D117_PRED = modeMap.indexOf("D117_PRED");
    const D153_PRED = modeMap.indexOf("D153_PRED");
    const D207_PRED = modeMap.indexOf("D207_PRED");

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
  drawFillBlock(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle, setFillStyle: (blockSize, c, r, sc, sr) => boolean) {
    let scale = dst.w / src.w;
    ctx.save();
    ctx.translate(-src.x * scale, -src.y * scale);
    this.visitBlocks("block", frame, (blockSize, c, r, sc, sr, bounds) => {
      bounds.multiplyScalar(scale);
      setFillStyle(blockSize, c, r, sc, sr) && ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    });
    ctx.restore();
  }

  visitBlocks(mode: string, frame: AnalyzerFrame, visitor: BlockVisitor) {
    let blockSize = frame.json["blockSize"];
    let blockSizeMap = frame.json["blockSizeMap"];

    let transformSize = frame.json["transformSize"];
    let transformSizeMap = frame.json["transformSizeMap"];


    var bounds = new Rectangle(0, 0, 0, 0);
    let rows = blockSize.length;
    let cols = blockSize[0].length;
    let S = MI_SIZE;
    if (mode === "block") {
      /**
       * Maps AnalyzerBlockSize enum to [w, h] log2 pairs.
       */
      // ["BLOCK_4X4", "BLOCK_4X8", "BLOCK_8X4", "BLOCK_8X8", "BLOCK_8X16", "BLOCK_16X8", "BLOCK_16X16", "BLOCK_16X32", "BLOCK_32X16", "BLOCK_32X32", "BLOCK_32X64", "BLOCK_64X32", "BLOCK_64X64"]
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
      const BLOCK_4X4 = blockSizeMap.indexOf("BLOCK_4X4");
      const BLOCK_8X4 = blockSizeMap.indexOf("BLOCK_8X4");
      const BLOCK_4X8 = blockSizeMap.indexOf("BLOCK_4X8");

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
      const TX_4X4 = transformSizeMap.indexOf("TX_4X4");
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
    }
  }
}

interface AnalyzerViewCompareComponentProps {
  decoderVideoUrlPairs: {decoderUrl: string, videoUrl: string} [];
  playbackFrameRate?: number;
  layers?: number;
  maxFrames?: number
}

export class AnalyzerBenchmarkComponent extends React.Component<{
  decoderVideoUrlPairs: {decoderUrl: string, videoUrl: string} [];
  playbackFrameRate?: number;
  maxFrames?: number
}, {
  decodedFrameCount: number,
  loading: "done" | "failed" | "loading",
  status: string
  elapsed: number;
}> {
  constructor() {
    super();
    this.state = {
      loading: "loading"
    } as any;
  }
  componentWillMount() {
    let decoderUrls = [];
    let videoUrls = [];
    this.props.decoderVideoUrlPairs.forEach(pair => {
      decoderUrls.push(pair.decoderUrl);
      videoUrls.push(pair.videoUrl);
    });
    this.load(decoderUrls, videoUrls);
  }
  load(decoderPaths: string[], videoPaths: string[]) {
    this.setState({ status: "Loading Decoders" } as any);
    Promise.all(decoderPaths.map(path => Decoder.loadDecoder(path))).then(decoders => {
      this.setState({ status: "Downloading Files" } as any);
      Promise.all(videoPaths.map(path => downloadFile(path))).then(bytes => {
        let decodedFrames = [];
        for (let i = 0; i < decoders.length; i++) {
          let decoder = decoders[i];
          decoder.openFileBytes(bytes[i]);
        }
        let groupNames = [];
        for (let i = 0; i < decoderPaths.length; i++) {
          groupNames.push(decoderPaths[i] + " - " + videoPaths[i]);
        }
        this.setState({ status: "Decoding Frames" } as any);
        let time = performance.now();
        Promise.all(decoders.map(decoder => this.decodeFrames(decoder, this.props.maxFrames))).then(frames => {
          this.setState({ frames: frames, groupNames: groupNames, loading: "done", elapsed: performance.now() - time } as any);
        });
      }).catch(e => {
        this.setState({ status: "Downloading Files Failed", loading: "error" } as any);
      });
    }).catch(e => {
      this.setState({ status: "Loading Decoders Failed", loading: "error" } as any);
    });
  }

  decodedFrameCount = 0;
  decodeFrames(decoder: Decoder, count: number): Promise<AnalyzerFrame[]>  {
    return new Promise((resolve, reject) => {
      let time = performance.now();
      let decodedFrames = [];
      let interval = setInterval(() => {
        decoder.setLayers(0);
        decoder.shouldReadImageData = false;
        decoder.readFrame().then((frames) => {
          if (this.decodedFrameCount % 10 == 0) {
            this.setState({ status: `Decoded ${this.decodedFrameCount} Frames ...` } as any);
          }
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
      }, 0);
    });
  }
  render() {
    if (this.state.loading != "done") {
      let icon = this.state.loading === "loading" ? <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> : <span className="glyphicon glyphicon-ban-circle"></span>;
      return <div className="panel">
        <span>{icon} {this.state.status}</span>
      </div>
    } else {
      return <div className="panel">
        <span>Decoded {this.decodedFrameCount} frames in {withCommas(this.state.elapsed)} milliseconds.</span>
      </div>
    }
  }
}

interface AnalyzerViewCompareComponentProps {
  decoderVideoUrlPairs: {decoderUrl: string, videoUrl: string} [];
  playbackFrameRate?: number;
  layers?: number;
  maxFrames?: number
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
    let videoUrls = [];
    this.props.decoderVideoUrlPairs.forEach(pair => {
      decoderUrls.push(pair.decoderUrl);
      videoUrls.push(pair.videoUrl);
    });
    this.load(decoderUrls, videoUrls);
  }
  load(decoderPaths: string[], videoPaths: string[]) {
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
        let groupNames = [];
        for (let i = 0; i < decoderPaths.length; i++) {
          let videoPath = videoPaths[i];
          let j = videoPath.lastIndexOf("/");
          if (j >= 0) {
            videoPath = videoPath.substring(j + 1);
          }
          groupNames.push(videoPath);
        }
        this.setState({ status: "Decoding Frames" } as any);
        Promise.all(decoders.map(decoder => this.decodeFrames(decoder, this.props.maxFrames))).then(frames => {
          this.setState({ frames: frames, groupNames: groupNames, loading: "done" } as any);
        });
      }).catch(e => {
        this.setState({ status: "Downloading Files Failed", loading: "error" } as any);
      });
    }).catch(e => {
      this.setState({ status: "Loading Decoders Failed", loading: "error" } as any);
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
      <AnalyzerView frames={this.state.frames} groupNames={this.state.groupNames} playbackFrameRate={this.props.playbackFrameRate} ></AnalyzerView>
    </div>;
  }
}

export class CreateAnalyzerUrlComponent extends React.Component<{

}, {
  urls: string [];
  exists: boolean [];
}> {
  timeout: any;
  constructor() {
    super();
    let urls = [];
    let exists = [];
    for (let i = 0; i < 10; i++) {
      urls.push("");
      exists.push(false);
    }
    this.state = {
      urls: urls,
      exists: exists
    } as any;
  }
  onChange(i, e) {
    let value = e.target.value;
    let state = this.state;
    state.urls[i] = e.target.value;
    this.setState(state);

    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      fileExists(state.urls[i]).then(exists => {
        let state = this.state;
        state.exists[i] = exists;
        this.setState(state);
      });
    }, 1000);
  }
  getValidationState(i): "success" | "warning" | "error" {
    if (this.state.urls[i] && !this.state.exists[i]) {
      return "error";
    }
    return "success";
  }
  render() {
    let urls = [];
    urls = this.state.urls.map((url, i) => {
      return <div style={{paddingBottom: "4px"}}>
        <FormGroup validationState={this.getValidationState(i)}>
          <FormControl key={i} type="text" value={url} placeholder="Enter a decoder or file url." onChange={this.onChange.bind(this, i)}></FormControl>
          <FormControl.Feedback />
        </FormGroup>
      </div>
    })
    let url = baseUrl + analyzerBaseUrl + "?" + this.state.urls.filter(s => !!s).map(s => {
      if (s.indexOf(".js") >= 0) {
        return "decoder=" + s;
      } else {
        return "file=" + s;
      }
    }).join("&");
    return <div className="panel">
      <h3>Analyzer Url Builder</h3>
      <Form>
        {urls}
      </Form>
      <a href={url}>{url}</a>
    </div>
  }
}