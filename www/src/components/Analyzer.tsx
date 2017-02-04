import * as React from "react";
import { ButtonGroup, Pagination, Button, Panel, Form, FormGroup, ControlLabel, FormControl, ButtonToolbar, Glyphicon } from "react-bootstrap";
import { } from "react-bootstrap";
import { appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile } from "../stores/Stores";
import { Decoder, Rectangle, Size, AnalyzerFrame, loadFramesFromJson, downloadFile, Histogram, Accounting, clamp, Vector } from "../analyzer";
import { Promise } from "es6-promise";

import { BarPlot, BarPlotTable, Data } from "./Plot";
declare var d3;
declare var Mousetrap;

const DEFAULT_MARGIN = { top: 10, right: 10, bottom: 20, left: 40 };
const MAX_FRAMES = 128;
const MI_SIZE_LOG2 = 3;
const MI_SIZE = 1 << MI_SIZE_LOG2;

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
      detail: "Display motion vectors, darker colors represent longer vectors.",
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
    // showBits: {
    //   key: "b",
    //   description: "Bits",
    //   detail: "Display bits.",
    //   default: false,
    //   value: undefined
    // },
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
    this.mousePosition = new Vector(0, 0);
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
  }
  drawLayers(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    this.state.showSkip && this.drawSkip(frame, ctx, src, dst);
    this.state.showMode && this.drawMode(frame, ctx, src, dst);
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
    if (this.state.scale != prevState.scale) {
      this.reset();
    }
    if (this.state.activeFrame >= 0) {
      this.draw(this.state.activeGroup, this.state.activeFrame);
    }
  }
  reset() {
    let imageData = this.props.frames[0][0].imageData;
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
    // ...
  }
  onMouseMove(event: MouseEvent) {
    this.handleMouseEvent(event);
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
  render() {
    let groups = this.props.frames;
    let groupFrameLinks = groups.map((group, i) => {
      let frameLinks = group.map((frames, j) => {
        return <a className={i == this.state.activeGroup && j == this.state.activeFrame ? "activeFrameLink" : "frameLink"} onClick={this.setActiveGroupAndFrame.bind(this, i, j)}>{j}</a>
      });
      let groupName = this.props.groupNames ? this.props.groupNames[i] : String(i);
      return <div className="frameContainer">{groupName} ({i + 1}): {frameLinks}</div>
    });

    let layerButtons = [];
    for (let name in this.options) {
      let option = this.options[name];
      layerButtons.push(
        <Button bsStyle={this.state[name] ? "primary" : "default"} bsSize="small" onClick={this.toggleLayer.bind(this, name)}>{option.description}: {option.key}</Button>
      );
    }

    let blockInfo = null;
    let frame = this.getActiveFrame();
    function getProperty(p: Vector, json: any, name: string): string{
      if (!json[name]) return "N/A";
      let v = json[name][p.y][p.x];
      if (!json[name + "Map"]) return String(v);
      return json[name + "Map"][v];
    }
    function getMotionVector(p: Vector, json: any) {
      let motionVectors = frame.json["motionVectors"];
      if (!motionVectors) return "N/A";
      let v = motionVectors[p.y][p.x];
      return `${v[0]},${v[1]} ${v[2]},${v[3]}`;
    }
    function getReferenceFrame(p: Vector, json: any) {
      let referenceFrame = frame.json["referenceFrame"];
      if (!referenceFrame) return "N/A";
      let map = frame.json["referenceFrameMap"];
      let v = referenceFrame[p.y][p.x];
      let a = v[0] >= 0 ? ((map && map[v[0]] !== undefined) ? map[v[0]] : v[0]) : "N/A";
      let b = v[1] >= 0 ? ((map && map[v[1]] !== undefined) ? map[v[1]] : v[1]) : "N/A";
      return `${a}, ${b}`;
    }
    if (frame) {
      let json = frame.json;
      let p = this.getParentMIPosition(frame, this.mousePosition);
      if (p) {
        blockInfo = <div className="sidePanel">
          <div>Block: {p.x} x {p.y}</div>
          <div>Block Size: {getProperty(p, json, "blockSize")}</div>
          <div>Transform Size: {getProperty(p, json, "transformSize")}</div>
          <div>Transform Type: {getProperty(p, json, "transformType")}</div>
          <div>Mode: {getProperty(p, json, "mode")}</div>
          <div>Skip: {getProperty(p, json, "skip")}</div>
          <div>Motion Vectors: {getMotionVector(p, json)}</div>
          <div>Reference Frame: {getReferenceFrame(p, json)}</div>
        </div>
      }
    }

    console.log("Render");
    let toolbox = null;
    if (this.state.showTools) {
      toolbox = <div className="toolbox" style={{padding: "10px"}}>
        <div style={{paddingTop: "4px"}}>
          {groupFrameLinks}
        </div>
        <div style={{paddingTop: "4px"}}>
          <ButtonGroup>
            <Button bsSize="small" onClick={this.toggleTools.bind(this)}>Toggle Tools: tab</Button>
            <Button bsSize="small" onClick={this.resetLayersAndActiveFrame.bind(this)}>Reset: r</Button>
            <Button bsSize="small" onClick={this.advanceFrame.bind(this, -1)}>Previous: ,</Button>
            <Button bsSize="small" onClick={this.playPause.bind(this)}>Play/Stop: space</Button>
            <Button bsSize="small" onClick={this.advanceFrame.bind(this, 1)}>Next: .</Button>
            <Button bsSize="small" onClick={this.zoom.bind(this, 1 / 2)}>Zoom Out: [</Button>
            <Button bsSize="small" onClick={this.zoom.bind(this, 2)}>Zoom In: ]</Button>
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
    </div>
  }

  drawSkip(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let skip = frame.json["skip"];
    this.drawFillBlock(frame, ctx, src, dst, (c, r, sc, sr) => {
      if (!skip[r][c]) {
        return false;
      }
      ctx.fillStyle = "red";
      return true;
    });
  }
  drawReferenceFrames(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle) {
    let reference = frame.json["referenceFrame"];
    this.drawFillBlock(frame, ctx, src, dst, (c, r, sc, sr) => {
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
    this.drawFillBlock(frame, ctx, src, dst, (c, r, sc, sr) => {
      ctx.fillStyle = COLORS[type[r][c]];
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
  drawFillBlock(frame: AnalyzerFrame, ctx: CanvasRenderingContext2D, src: Rectangle, dst: Rectangle, setFillStyle: (c, r, sc, sr) => boolean) {
    let scale = dst.w / src.w;
    ctx.save();
    ctx.translate(-src.x * scale, -src.y * scale);
    this.visitBlocks("block", frame, (blockSize, c, r, sc, sr, bounds) => {
      bounds.multiplyScalar(scale);
      setFillStyle(c, r, sc, sr) && ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
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

export class AnalyzerViewCompareComponent extends React.Component<AnalyzerViewCompareComponentProps, {
  frames: AnalyzerFrame [][],
  groupNames: string [],
  analyzerFailedToLoad: boolean,
  decodedFrameCount: number,
  loading: false,
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
      loading: true,
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
          groupNames.push(decoderPaths[i] + " - " + videoPaths[i]);
        }
        this.setState({ status: "Decoding Frames" } as any);
        Promise.all(decoders.map(decoder => this.decodeFrames(decoder, this.props.maxFrames))).then(frames => {
          this.setState({ frames: frames, groupNames: groupNames, loading: false } as any);
        });
      });
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
    if (this.state.loading) {
      return <div className="panel">
        <span><span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> {this.state.status}</span>
      </div>
    }

    return <div>
      <AnalyzerView frames={this.state.frames} groupNames={this.state.groupNames} playbackFrameRate={this.props.playbackFrameRate} ></AnalyzerView>
    </div>;
  }
}

interface AnalyzerComponentProps {
  decoderUrl: string;
  videoUrl: string;
  playbackFrameRate?: number;
  layers?: number;
  maxFrames?: number
}

export class AnalyzerComponent extends React.Component<AnalyzerComponentProps, {
    frames: AnalyzerFrame[];
    analyzerFailedToLoad: boolean | null
    decoding: boolean;
  }> {
  bitsSvg: SVGElement;
  symbolsSvg: SVGElement;
  blockSizeSvg: SVGElement;
  transformSizeSvg: SVGElement;
  transformTypeSvg: SVGElement;
  predictionModeSvg: SVGElement;
  skipSvg: SVGElement;

  public static defaultProps: AnalyzerComponentProps = {
    decoderUrl: null,
    videoUrl: null,
    playbackFrameRate: 30,
    maxFrames: MAX_FRAMES,
    layers: 0xFFFFFFFF
  };

  constructor() {
    super();
    this.state = {
      frames: null,
      analyzerFailedToLoad: null,
      decoding: false
    };
  }
  componentWillMount() {
    this.load(this.props.decoderUrl, this.props.videoUrl);
  }
  load(decoderPath: string, videoPath: string) {
    if (videoPath.endsWith(".json")) {
      loadFramesFromJson(videoPath).then((frames) => {
        frames = frames.slice(0, this.props.maxFrames);
        this.setState({ frames, analyzerFailedToLoad: false } as any);
        this.renderCharts();
      });
    } else {
      Decoder.loadDecoder(decoderPath).then((decoder) => {
        console.info(decoder);
        downloadFile(videoPath).then((bytes) => {
          decoder.openFileBytes(bytes);
          this.setState({ frames: [], analyzerFailedToLoad: false } as any);
          this.decode(decoder, this.props.maxFrames);
        }).catch(() => {
          this.setState({ analyzerFailedToLoad: true } as any);
        });
      }).catch(() => {
        this.setState({ analyzerFailedToLoad: true } as any);
      });
    }
  }
  decode(analyzer: Decoder, count: number) {
    this.decodeFrames(analyzer, count, () => {
      this.renderCharts();
    });
  }
  renderCharts() {
    let frames = this.state.frames;
    this.renderBitsChart();
    this.renderSymbolsChart();
    this.renderHistogram(this.blockSizeSvg, frames.map(x => x.blockSizeHist));
    this.renderHistogram(this.transformSizeSvg, frames.map(x => x.transformSizeHist));
    this.renderHistogram(this.transformTypeSvg, frames.map(x => x.transformTypeHist));
    this.renderHistogram(this.predictionModeSvg, frames.map(x => x.predictionModeHist));
    this.renderHistogram(this.skipSvg, frames.map(x => x.skipHist));
  }
  decodeFrames(deocder: Decoder, count: number, next: any) {
    let time = performance.now();
    this.setState({ decoding: true } as any);
    let interval = setInterval(() => {
      deocder.setLayers(this.props.layers);
      deocder.readFrame().then((frames) => {
        this.forceUpdate();
        if (!frames) {
          clearInterval(interval);
          this.setState({ decoding: false } as any);
          console.info(`Decode Time: ${performance.now() - time}`);
          next();
          return;
        }
        frames.forEach(frame => {
          this.state.frames.push(frame);
        });
        if (--count <= 0) {
          clearInterval(interval);
          this.setState({ decoding: false } as any);
          console.info(`Decode Time: ${performance.now() - time}`);
          next();
        }
      });
    }, 16);
  }
  renderChart(element: SVGElement, names: string[], data: any[], yDomain = [0, 1]) {
    let legendWidth = 128;
    var svg = d3.select(element),
      margin = DEFAULT_MARGIN,
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom,
      g = svg.append("g").attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

    var x = d3.scaleBand()
      .rangeRound([0, width - legendWidth])
      .padding(0.1)
      .align(0.1);
    var y = d3.scaleLinear().rangeRound([height, 0]);
    var z = d3.scaleOrdinal(d3.schemeCategory20);

    var stack = d3.stack();

    x.domain(data.map((d, i) => i));
    x.domain(d3.range(data.length));
    y.domain(yDomain).nice();
    z.domain(names.length);

    var tooltip = d3.select("body")
      .append("div")
      .style("padding", "4px")
      .style("background-color", "white")
      .style("position", "absolute")
      .style("z-index", "10")
      .style("visibility", "hidden")
      .text("a simple tooltip");

    g.selectAll(".serie")
      .data(stack.keys(names)(data))
      .enter().append("g")
      .attr("class", "serie")
      .attr("fill", function (d) {
        return z(d.key);
      })
      .selectAll("rect")
      .data(function (d) {
        return d;
      })
      .enter().append("rect")
      .attr("x", function (d, i) {
        return x(i);
      })
      .attr("y", function (d) {
        return y(d[1]);
      })
      .attr("height", function (d) {
        return y(d[0]) - y(d[1]);
      })
      .attr("width", x.bandwidth())
      .on("mouseover", function (d) {
        return tooltip.style("visibility", "visible");
      })
      .on("mousemove", function (d) {
        tooltip.style("top", (d3.event.pageY - 10) + "px");
        tooltip.style("left", (d3.event.pageX + 10) + "px");
        // let text = ((d[1] - d[0]) * 100).toFixed(2) + "%";
        let text = (d[1] - d[0]).toFixed(3);
        tooltip.text(text);
      })
      .on("mouseout", function (d) {
        return tooltip.style("visibility", "hidden");
      });

    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y).ticks(5, "s"))
      .append("text")
    // .attr("x", 2)
    // .attr("y", y(y.ticks(5).pop()))
    // .attr("dy", "0.35em")
    // .attr("text-anchor", "start")
    // .attr("fill", "#000")
    // .text("Population");

    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0, " + height + ")")
      .call(d3.axisBottom(x));

    var legend = g.selectAll(".legend")
      .data(names)
      .enter().append("g")
      .attr("class", "legend")
      .attr("transform", function (d, i) { return `translate(${width - legendWidth}, ${i * 16})`; })
      .style("font", "10px sans-serif");

    legend.append("rect")
      .attr("x", 0)
      .attr("y", 2)
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", z);

    legend.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .attr("dy", ".35em")
      .attr("text-anchor", "start")
      .text(function (d) { return d; });
  }
  renderHistogram(element: SVGElement, histograms: Histogram[]) {
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
    this.renderChart(element, names, rows);
    return;
  }
  renderBitsChart() {
    console.debug("Rendering Chart");
    let data = [];
    let frames = this.state.frames;
    let names = Accounting.getSortedSymbolNames(frames.map(frame => frame.accounting));
    let max = 0;
    frames.forEach((frame, i) => {
      let row = { frame: i, Bits: 0 };
      let symbols = frame.accounting.createFrameSymbols();
      let total = 0;
      names.forEach(name => {
        let symbol = symbols[name];
        let bits = symbol ? symbol.bits : 0;
        total += bits;
      });
      total >>= 3;
      row.Bits = total;
      max = Math.max(max, total);
      data.push(row);
    });
    this.renderChart(this.bitsSvg, ["Bits"], data, [0, max]);
  }
  renderSymbolsChart() {
    console.debug("Rendering Chart");

    let data = [];
    let frames = this.state.frames;
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

      names.forEach(name => {
        let symbol = symbols[name];
        let bits = symbol ? symbol.bits : 0;
        row[name] = bits / total;
      });

      data.push(row);
    });

    this.renderChart(this.symbolsSvg, names, data);
  }
  render() {
    console.debug("Rendering Analyzer");
    let frames = this.state.frames;
    let analyzerHeader = `Analyzer Report: ${this.props.videoUrl}`;
    if (!frames) {
      return <Panel header={analyzerHeader}>
        {this.state.analyzerFailedToLoad ?
          <span><span className="glyphicon glyphicon-warning-sign"></span> Analyzer failed to load. </span> :
          <span><span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Loading frames ... </span>
        }
      </Panel>
    }

    let decoding = this.state.decoding;
    if (decoding) {
      return <Panel header={analyzerHeader}>
        <span><span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Decoding frame {frames.length}...</span>
      </Panel>
    }

    return <Panel header={analyzerHeader}>
      <div>
        <AnalyzerView frames={null} playbackFrameRate={this.props.playbackFrameRate} ></AnalyzerView>
      </div>
      <div id="a" className="chartParent">
        <a href="#a">Bits per frame</a><br />
        <svg ref={(self: any) => this.bitsSvg = self} width="1600" height="100"></svg>
      </div>

      <div id="b" className="chartParent">
        <a href="#b">% of bits used to encode symbols per frame</a><br />
        <svg ref={(self: any) => this.symbolsSvg = self} width="1600" height="300"></svg>
      </div>

      <div id="c" className="chartParent">
        <a href="#c">% of pixels covered by block size per frame</a><br />
        <svg ref={(self: any) => this.blockSizeSvg = self} width="1600" height="300"></svg>
      </div>

      <div id="d" className="chartParent">
        <a href="#d">% of pixels covered by transform size per frame</a><br />
        <svg ref={(self: any) => this.transformSizeSvg = self} width="1600" height="300"></svg>
      </div>

      <div id="e" className="chartParent">
        <a href="#e">% of pixels covered by transform type per frame</a><br />
        <svg ref={(self: any) => this.transformTypeSvg = self} width="1600" height="300"></svg>
      </div>

      <div id="f" className="chartParent">
        <a href="#f">% of pixels predicted by mode per frame</a><br />
        <svg ref={(self: any) => this.predictionModeSvg = self} width="1600" height="300"></svg>
      </div>

      <div id="g" className="chartParent">
        <a href="#g">% of pixels skipped per frame</a><br />
        <svg ref={(self: any) => this.skipSvg = self} width="1600" height="100"></svg>
      </div>
    </Panel>
  }
}