import * as React from "react";
import { ScaleLinear, ScaleLogarithmic, scaleLinear, scaleLog } from "d3-scale";

export function floorTo(v: number, round: number) {
  return Math.floor(v / round) * round;
}

export function ceilTo(v: number, round: number) {
  return Math.ceil(v / round) * round;
}

export function epsilonEquals(value: number, other: number): boolean {
  return Math.abs(value - other) < 0.0000001;
}

export class Margins {
  t: number;
  r: number;
  b: number;
  l: number;
  constructor(t: number, r: number, b: number, l: number) {
    this.t = t;
    this.r = r;
    this.b = b;
    this.l = l;
  }
  scale(s: number) {
    this.t *= s;
    this.r *= s;
    this.b *= s;
    this.l *= s;
  }
}

export class Size {
  w: number;
  h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  setElements(w: number, h: number): Size {
    this.w = w;
    this.h = h;
    return this;
  }

  clone(): Size {
    return new Size(this.w, this.h);
  }
}

function segmentIntersection(a0: Point, a1: Point, b0: Point, b1: Point) {
  var ua = 0, ub = 0, deonminator = (b1.y - b0.y) * (a1.x - a0.x) - (b1.x - b0.x) * (a1.y - a0.y);
  if (deonminator == 0) {
    return null;
  }
  ua = ((b1.x - b0.x) * (a0.y - b0.y) - (b1.y - b0.y) * (a0.x - b0.x)) / deonminator;
  ub = ((a1.x - a0.x) * (a0.y - b0.y) - (a1.y - a0.y) * (a0.x - b0.x)) / deonminator;
  return {
    intersection: new Point(a0.x + ua * (a1.x - a0.x), a0.y + ua * (a1.y - a0.y)),
    intersectsSegmentA: ua >= 0 && ua <= 1,
    intersectsSegmentB: ub >= 0 && ub <= 1
  };
}

export class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setElements(x: number, y: number): Point {
    this.x = x;
    this.y = y;
    return this;
  }

  set(other: Point): Point {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  dot(other: Point): number {
    return this.x * other.x + this.y * other.y;
  }

  squaredLength(): number {
    return this.dot(this);
  }

  distanceTo(other: Point): number {
    return Math.sqrt(this.dot(other));
  }

  sub(other: Point): Point {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  mul(value: number): Point {
    this.x *= value;
    this.y *= value;
    return this;
  }

  clone(): Point {
    return new Point(this.x, this.y);
  }

  toString(digits: number = 2) {
    return "{x: " + this.x.toFixed(digits) + ", y: " + this.y.toFixed(digits) + "}";
  }

  static createEmpty(): Point {
    return new Point(0, 0);
  }
}

export class Rectangle {
  static allocationCount = 0;

  x: number;
  y: number;
  w: number;
  h: number;

  private static _temporary = new Rectangle(0, 0, 0, 0);

  private static _dirtyStack: Rectangle[] = [];

  constructor(x: number, y: number, w: number, h: number) {
    this.setElements(x, y, w, h);
    Rectangle.allocationCount++;
  }

  setElements(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  set(other: Rectangle) {
    this.x = other.x;
    this.y = other.y;
    this.w = other.w;
    this.h = other.h;
  }

  contains(other: Rectangle): boolean {
    var r1 = other.x + other.w;
    var b1 = other.y + other.h;
    var r2 = this.x + this.w;
    var b2 = this.y + this.h;
    return (other.x >= this.x) &&
      (other.x < r2) &&
      (other.y >= this.y) &&
      (other.y < b2) &&
      (r1 > this.x) &&
      (r1 <= r2) &&
      (b1 > this.y) &&
      (b1 <= b2);
  }

  containsPoint(point: Point): boolean {
    return (point.x >= this.x) &&
      (point.x < this.x + this.w) &&
      (point.y >= this.y) &&
      (point.y < this.y + this.h);
  }

  extendPoint(point: Point) {
    if (this.containsPoint(point)) {
      return;
    }
    let x = this.x, y = this.y;
    this.x = Math.min(x, point.x);
    this.y = Math.min(y, point.y);
    let x0 = x + this.w;
    let y0 = y + this.h;
    x0 = Math.max(x0, point.x);
    y0 = Math.max(y0, point.y);
    this.w = x0 - this.x;
    this.h = y0 - this.y;
  }

  isContained(others: Rectangle[]) {
    for (var i = 0; i < others.length; i++) {
      if (others[i].contains(this)) {
        return true;
      }
    }
    return false;
  }

  isSmallerThan(other: Rectangle): boolean {
    return this.w < other.w && this.h < other.h;
  }

  isLargerThan(other: Rectangle): boolean {
    return this.w > other.w && this.h > other.h;
  }

  union(other: Rectangle) {
    if (this.isEmpty()) {
      this.set(other);
      return;
    } else if (other.isEmpty()) {
      return;
    }
    var x = this.x, y = this.y;
    if (this.x > other.x) {
      x = other.x;
    }
    if (this.y > other.y) {
      y = other.y;
    }
    var x0 = this.x + this.w;
    if (x0 < other.x + other.w) {
      x0 = other.x + other.w;
    }
    var y0 = this.y + this.h;
    if (y0 < other.y + other.h) {
      y0 = other.y + other.h;
    }
    this.x = x;
    this.y = y;
    this.w = x0 - x;
    this.h = y0 - y;
  }

  isEmpty(): boolean {
    return this.w <= 0 || this.h <= 0;
  }

  setEmpty() {
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
  }

  intersect(other: Rectangle) {
    var result = Rectangle.createEmpty();
    if (this.isEmpty() || other.isEmpty()) {
      result.setEmpty();
      return result;
    }
    result.x = Math.max(this.x, other.x);
    result.y = Math.max(this.y, other.y);
    result.w = Math.min(this.x + this.w, other.x + other.w) - result.x;
    result.h = Math.min(this.y + this.h, other.y + other.h) - result.y;
    if (result.isEmpty()) {
      result.setEmpty();
    }
    this.set(result);
  }

  intersects(other: Rectangle): boolean {
    if (this.isEmpty() || other.isEmpty()) {
      return false;
    }
    var x = Math.max(this.x, other.x);
    var y = Math.max(this.y, other.y);
    var w = Math.min(this.x + this.w, other.x + other.w) - x;
    var h = Math.min(this.y + this.h, other.y + other.h) - y;
    return !(w <= 0 || h <= 0);
  }

  area(): number {
    return this.w * this.h;
  }

  clone(): Rectangle {
    var rectangle: Rectangle = Rectangle.allocate();
    rectangle.set(this);
    return rectangle;
  }

  static allocate(): Rectangle {
    var dirtyStack = Rectangle._dirtyStack;
    if (dirtyStack.length) {
      return dirtyStack.pop();
    } else {
      return new Rectangle(12345, 67890, 12345, 67890);
    }
  }

  free() {
    Rectangle._dirtyStack.push(this);
  }

  /**
   * Snaps the rectangle to pixel boundaries. The computed rectangle covers
   * the original rectangle.
   */
  snap(): Rectangle {
    var x1 = Math.ceil(this.x + this.w);
    var y1 = Math.ceil(this.y + this.h);
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.w = x1 - this.x;
    this.h = y1 - this.y;
    return this;
  }

  snapTo(dx: number, dy: number): Rectangle {
    var x1 = ceilTo(this.x + this.w, dx);
    var y1 = ceilTo(this.y + this.h, dy);
    this.x = floorTo(this.x, dx);
    this.y = floorTo(this.y, dy);
    this.w = x1 - this.x;
    this.h = y1 - this.y;
    return this;
  }

  scale(x: number, y: number): Rectangle {
    this.x *= x;
    this.y *= y;
    this.w *= x;
    this.h *= y;
    return this;
  }

  offset(x: number, y: number): Rectangle {
    this.x += x;
    this.y += y;
    return this;
  }

  resize(w: number, h: number): Rectangle {
    this.w += w;
    this.h += h;
    return this;
  }

  expand(w: number, h: number): Rectangle {
    this.offset(-w, -h).resize(2 * w, 2 * h);
    return this;
  }

  expandPercent(w: number, h: number): Rectangle {
    w = this.w *= w;
    h = this.h *= h;
    this.offset(-w, -h).resize(2 * w, 2 * h);
    return this;
  }

  getCenter(): Point {
    return new Point(this.x + this.w / 2, this.y + this.h / 2);
  }

  getAbsoluteBounds(): Rectangle {
    return new Rectangle(0, 0, this.w, this.h);
  }

  toString(digits: number = 2): string {
    return "{" +
      this.x.toFixed(digits) + ", " +
      this.y.toFixed(digits) + ", " +
      this.w.toFixed(digits) + ", " +
      this.h.toFixed(digits) +
      "}";
  }

  static createEmpty(): Rectangle {
    var rectangle = Rectangle.allocate();
    rectangle.setEmpty();
    return rectangle;
  }

  static createFromPoints(points: number[][]) {
    let minX = minArray(points, 0);
    let maxX = maxArray(points, 0);
    let minY = minArray(points, 1);
    let maxY = maxArray(points, 1);
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  static createSquare(size: number): Rectangle {
    return new Rectangle(-size / 2, -size / 2, size, size);
  }

  getCorners(points: Point[]) {
    points[0].x = this.x;
    points[0].y = this.y;

    points[1].x = this.x + this.w;
    points[1].y = this.y;

    points[2].x = this.x + this.w;
    points[2].y = this.y + this.h;

    points[3].x = this.x;
    points[3].y = this.y + this.h;
  }
}

interface PlotProps {
  width: number;
  height: number;
}

interface PlotState {}

export interface PlotAxis {
  title?: string;
  min?: number;
  max?: number;
  log?: boolean
}

export class Plot<P extends PlotProps, S extends PlotState> extends React.Component<P, S> {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ratio: number = window.devicePixelRatio;

  yScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
  xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;

  device: Rectangle;

  textSize = 7;
  textPadding = 4;

  tickBarW = 20;
  tickBarH = 20;
  margins = new Margins(10, 10, this.tickBarH, this.tickBarW);

  xTicks = 10;
  yTicks = 5;

  darkTheme = {
    backgroundColor: "#212121",
    gridLineColor: "#424242"
  }

  lightTheme = {
    backgroundColor: "#F4F4F4",
    gridLineColor: "#FFFFFF",
    tickTextColor: "#000000",
    tickLineColor: "#616161"
  }

  theme = this.lightTheme;

  constructor() {
    super();
    this.xScale = scaleLinear().domain([0, 1]);
    this.yScale = scaleLinear().domain([0, 1]);
  }
  componentDidMount() {
    this.canvas.addEventListener("mousemove", (e) => {
      var r = this.canvas.getBoundingClientRect();
      var p = new Point(e.clientX - r.left, -(e.clientY - r.top - r.height));
      p.mul(this.ratio);
      this.onMouseMove(p);
    });
    this.canvas.addEventListener("mouseleave", (e) => {
      this.draw();
    })
  }
  onMouseMove(dp: Point) {
    this.draw();
    this.drawCrosshairs(dp);
  }
  drawCrosshairs(dp: Point, v = true, h = true) {
    this.ctx.strokeStyle = "#D0D0D0";
    h && this.drawDeviceLine(new Point(0, dp.y), new Point(this.device.w, dp.y));
    v && this.drawDeviceLine(new Point(dp.x, 0), new Point(dp.x, this.device.h));
  }
  resetDeviceAndViewport(w: number, h: number) {
    this.device = new Rectangle(0, 0, w * this.ratio, h * this.ratio);
    this.canvas.width = this.device.w;
    this.canvas.height = this.device.h;
    let ratio = this.device.h / this.device.w;
    this.ctx.setTransform(1, 0, 0, -1, 0, this.device.h);
    this.xTicks = (this.device.w / this.ratio) / 100 | 0;
  }
  componentWillReceiveProps(nextProps: P, nextContext: any) {
    if (this.props.width != nextProps.width || this.props.height != nextProps.height) {
      this.resetDeviceAndViewport(nextProps.width, nextProps.height);
    }
  }
  canvasDidMount(canvas: HTMLCanvasElement) {
    if (!canvas || this.canvas) {
      return;
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resetDeviceAndViewport(this.props.width, this.props.height);
    this.draw();
  }

  draw() {
    this.updateScales();
    this.drawBackground();
    this.drawGridLines();
  }
  updateScales() {
    let ratio = this.ratio;
    let m = this.margins;
    let t = m.t * ratio;
    let r = m.r * ratio;
    let b = m.b * ratio;
    let l = m.l * ratio;
    this.xScale.range([l, this.device.w - r]);
    this.yScale.range([b, this.device.h - t]);
  }
  transformPoint(point: Point): Point {
    point.x = this.xScale(point.x);
    point.y = this.yScale(point.y);
    return point;
  }
  inverseTransformPoint(point: Point): Point {
    point.x = this.xScale.invert(point.x);
    point.y = this.yScale.invert(point.y);
    return point;
  }
  transformSize(size: Size): Size {
    return size;
  }
  drawLine(a: Point, b: Point) {
    a = this.transformPoint(a.clone());
    b = this.transformPoint(b.clone());
    this.drawDeviceLine(a, b);
  }
  fillRect(p: Point, s: Size) {
    p = this.transformPoint(p.clone());
    s = this.transformSize(s.clone());
    this.fillDeviceRect(p, s);
  }
  fillDeviceRect(p: Point, s: Size) {
    let c = this.ctx;
    c.beginPath()
    c.fillRect(p.x, p.y, s.w, s.h);
    c.fill();
  }
  drawDeviceLine(a: Point, b: Point) {
    let c = this.ctx;
    c.beginPath()
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }
  drawDot(a: Point, radius = 2) {
    let c = this.ctx;
    a = this.transformPoint(a.clone());
    c.beginPath()
    c.beginPath();
    c.arc(a.x, a.y, radius * this.ratio, 0, 2 * Math.PI);
    c.stroke();
    c.fill();
  }
  drawText(a: Point, text: string, dx = 0, dy = 0, hAlign = "left", vAlign = "bottom", size = this.textSize) {
    a = this.transformPoint(a.clone());
    this.drawDeviceText(a, text, dx, dy, hAlign, vAlign, size);
  }
  drawDeviceText(a: Point, text: string, dx = 0, dy = 0, hAlign = "left", vAlign = "bottom", size = this.textSize) {
    let c = this.ctx;
    c.font = (size * this.ratio) + "pt Roboto Mono";
    c.save();
    c.setTransform(1, 0, 0, 1, 0, this.device.h);
    c.textAlign = hAlign;
    c.textBaseline = vAlign;
    c.fillText(text, a.x + dx, -a.y + -dy);
    c.restore();
  }
  drawBackground() {
    this.ctx.fillStyle = this.theme.backgroundColor;
    let r = this.device;
    this.ctx.fillRect(0, 0, r.w, r.h);
  }
  drawGridLines() {
    let c = this.ctx;
    c.strokeStyle = this.theme.gridLineColor;
    c.lineWidth = 2;
    let a = Point.createEmpty();
    let b = Point.createEmpty();
    let xDomain = this.xScale.domain();
    let yDomain = this.yScale.domain();
    this.xScale.ticks(this.xTicks).forEach(tick => {
      a.setElements(tick, yDomain[0]);
      b.setElements(tick, yDomain[1]);
      this.drawLine(a, b);
    });
    this.yScale.ticks(this.yTicks).forEach(tick => {
      a.setElements(xDomain[0], tick);
      b.setElements(xDomain[1], tick);
      this.drawLine(a, b);
    });
  }
  drawTickBars() {
    let c = this.ctx;
    c.fillStyle = this.theme.tickTextColor;
    c.lineWidth = 2;

    let a = Point.createEmpty();
    let b = Point.createEmpty();
    let xDomain = this.xScale.domain();
    let yDomain = this.yScale.domain();

    let ticks = this.xScale.ticks(this.xTicks);
    let tickFormat = this.xScale.tickFormat(this.xTicks, ".2");
    let textPadding = this.textPadding * this.ratio;

    ticks.forEach((tick, i) => {
      a.setElements(tick, yDomain[0]);
      this.transformPoint(a);
      this.drawDeviceText(a, tickFormat(tick), 0, -textPadding, "center", "top");
    });

    ticks = this.yScale.ticks(this.yTicks);
    tickFormat = this.yScale.tickFormat(this.yTicks, ".2");

    ticks.forEach((tick, i) => {
      a.setElements(xDomain[0], tick);
      this.transformPoint(a);
      this.drawDeviceText(a, tickFormat(tick), -textPadding, 0, "right", "middle");
    });

    c.strokeStyle = this.theme.tickLineColor;
    a.setElements(xDomain[0], yDomain[0]);
    b.setElements(xDomain[0], yDomain[1]);
    this.drawLine(a, b);

    a.setElements(xDomain[0], yDomain[0]);
    b.setElements(xDomain[1], yDomain[0]);
    this.drawLine(a, b);

  }
  render() {
    console.debug("Rendering Plot");
    if (this.canvas && this.ctx) {
      this.draw();
    }
    return <canvas style={{ width: this.props.width, height: this.props.height }} ref={this.canvasDidMount.bind(this)} />
  }
}

export interface ScatterPlotSeries {
  name: string;
  color: string;
  values: number[][];
  xAxis: PlotAxis;
  yAxis: PlotAxis;
}

export interface ScatterPlotProps extends PlotProps {
  series: ScatterPlotSeries[];
}

export interface ScatterPlotState extends PlotState {
  series: ScatterPlotSeries[];
}

function minArray(array: number[][], index: number) {
  let min = Number.MAX_VALUE;
  for (let i = 0; i < array.length; i++) {
    let v = array[i][index];
    if (isNaN(v)) continue
    min = Math.min(min, v);
  }
  return min;
}

function maxArray(array: number[][], index: number) {
  let max = Number.MIN_VALUE;
  for (let i = 0; i < array.length; i++) {
    let v = array[i][index];
    if (isNaN(v)) continue
    max = Math.max(max, v);
  }
  return max;
}

export function sortArray(array: number[][], index: number) {
  array.sort((a, b) => {
    return a[index] - b[index];
  });
}

export class ScatterPlot<P extends ScatterPlotProps, S extends ScatterPlotState> extends Plot<P, S> {
  constructor(props: ScatterPlotProps) {
    super();
    this.state = { series: props.series } as any;
  }

  componentWillReceiveProps(nextProps: P, nextContext: any) {
    super.componentWillReceiveProps(nextProps, nextContext);
    if (this.props.series != nextProps.series ||
      this.props.width != nextProps.width ||
      this.props.height != nextProps.height) {
      this.setState({ series: nextProps.series } as any, () => {
        this.fitSeries();
        this.draw();
      })
    }
  }

  componentDidMount() {
    super.componentDidMount();
    this.fitSeries();
  }

  resetDeviceAndViewport(w: number, h: number) {
    super.resetDeviceAndViewport(w, h);
    this.fitSeries();
  }

  fitSeries() {
    let series = this.state.series;
    let a = Point.createEmpty();
    let r = new Rectangle(0, 0, 0, 0);
    let xLog = false;
    let yLog = false;
    series.forEach(s => {
      let v = s.values.slice(0);
      let xAxis = s.xAxis || {};
      let yAxis = s.yAxis || {};
      v.push([+xAxis.min, +yAxis.min]);
      v.push([+xAxis.max, +yAxis.max]);
      r.union(Rectangle.createFromPoints(v));
      if (xAxis.log) xLog = true;
      if (yAxis.log) yLog = true;
    });
    this.xScale = xLog ? scaleLog() : scaleLinear();
    this.yScale = yLog ? scaleLog() : scaleLinear();
    this.xScale.domain([r.x, r.x + r.w]);
    this.yScale.domain([r.y, r.y + r.h]);
  }
  drawLegend() {
    let c = this.ctx;
    let r = this.ratio;
    let series = this.state.series;

    let p = 4 * r;
    let w = 12 * r;
    let h = 12 * r;

    let offsetY = this.tickBarH * r + 2 * p;
    let offsetX = this.device.w - p - w - 2 * p;
    for (let j = 0; j < series.length; j++) {
      let s = series[series.length - j - 1];
      c.fillStyle = c.strokeStyle = s.color;
      c.fillRect(offsetX, offsetY + j * (h + p), w, h);
      c.fillStyle = "#000000";
      let text = s.name;
      if (c.measureText(text).width > this.device.w) {
        text = s.name;
      }
      this.drawDeviceText(new Point(offsetX - 2 * p, offsetY + j * (h + p)), text, 0, 0, "right", "bottom");
    }
  }
  draw() {
    super.draw();
    this.drawLegend();
    let c = this.ctx;
    let series = this.state.series;
    let a = Point.createEmpty();
    let b = Point.createEmpty();

    for (let j = 0; j < series.length; j++) {
      c.fillStyle = c.strokeStyle = series[j].color;
      let s = series[j];
      let v = s.values;
      for (let i = 1; i < v.length; i++) {
        a.setElements(v[i - 1][0], v[i - 1][1]);
        b.setElements(v[i][0], v[i][1]);
        this.drawLine(a, b);
        this.drawDot(a);
        if (i == v.length - 1) {
          this.drawDot(b);
        }
      }
    }
    this.drawTickBars();
  }
}

export interface BDRatePlotProps extends ScatterPlotProps {
}

export interface BDRatePlotState extends ScatterPlotState {
  series: ScatterPlotSeries[];
}

export class BDRatePlot extends ScatterPlot<BDRatePlotProps, BDRatePlotState> {
  constructor(props: ScatterPlotProps) {
    super(props);
    this.state = { series: props.series };
  }

  drawCrosshairs(dp: Point) {
    super.drawCrosshairs(dp);
    return;
    let p = this.inverseTransformPoint(dp.clone());
    let series = this.state.series;
    let vIntersections: {series: ScatterPlotSeries, p: Point} [] = [];
    let hIntersections: {series: ScatterPlotSeries, p: Point} [] = [];
    for (let j = 0; j < series.length; j++) {
      let s = series[j];
      let v = s.values;
      let v0 = new Point(p.x, 0);
      let v1 = new Point(p.x, 100);

      let h0 = new Point(0, p.y);
      let h1 = new Point(100, p.y);

      for (let i = 1; i < v.length; i++) {
        let b0 = new Point(v[i - 1][0], v[i - 1][1]);
        let b1 = new Point(v[i][0], v[i][1]);
        let result = segmentIntersection(v0, v1, b0, b1);
        if (result && result.intersectsSegmentA && result.intersectsSegmentB) {
          vIntersections.push({series: s, p: result.intersection});
          this.ctx.globalAlpha = 0.2;
          this.ctx.strokeStyle = s.color;
          this.drawLine(new Point(0, result.intersection.y), new Point(1000, result.intersection.y));
          this.ctx.globalAlpha = 1;
        }

        result = segmentIntersection(h0, h1, b0, b1);
        if (result && result.intersectsSegmentA && result.intersectsSegmentB) {
          hIntersections.push({series: s, p: result.intersection});
          this.ctx.globalAlpha = 0.2;
          this.ctx.strokeStyle = s.color;
          this.drawLine(new Point(result.intersection.x, 0), new Point(result.intersection.x, 1000));
          this.ctx.globalAlpha = 1;
        }
      }
    }
    this.ctx.fillStyle = "#000000";

    vIntersections.forEach(o => this.drawDot(o.p, 1));
    hIntersections.forEach(o => this.drawDot(o.p, 1));

    // vIntersections.sort((a, b) => { return a.p.y - b.p.y; });
    // hIntersections.sort((a, b) => { return a.p.x - b.p.x; });

    function toString(intersections: {series: ScatterPlotSeries, p: Point} [], isX = true) {
      let a = [];
      let b = [];
      for (let i = 0; i < intersections.length; i++) {
        let n = intersections[i].series.name;
        let p = intersections[i].p;
        let v = (isX ? p.x : p.y);
        a.push(n + " = " + v.toFixed(2));
        if (i > 0) {
          let lastN = intersections[i - 1].series.name;
          let lastP = intersections[i - 1].p;
          let lastV = (isX ? lastP.x : lastP.y);
          let d = v - lastV;
          a.push(n + " - " + lastN + " = " + d.toFixed(2) + " (" + ((d / lastV) * 100).toFixed(2) + "%)");
        }
      }
      return a.join(", ");
    }

    if (hIntersections.length) {
      let last = hIntersections[hIntersections.length - 1].p;
      let s = toString(hIntersections, true);
      let dp = this.transformPoint(last.clone());
      dp.y = this.device.h;
      this.drawDeviceText(dp, s, 8, -8, "left", "top", 7);
    }

    if (vIntersections.length) {
      let last = vIntersections[vIntersections.length - 1].p;
      let s = toString(vIntersections, false);
      let dp = this.transformPoint(last.clone());
      dp.x = this.device.w;
      this.drawDeviceText(dp, s, -8, 8, "right", "bottom", 7);
    }
  }
}

export module Data {
  export class Table {
    columns: Column [] = [];
    rows: Row [] = [];
    addColumn(type: string, name: string) {
      this.columns.push(new Column(type, name));
    }
    addRow(row: Row) {
      this.rows.push(row);
    }
    addRows(rows: any [][]) {
      rows.forEach(row => {
        this.addRow(new Row(row.map(value => {
          return new Cell(value);
        })))
      });
    }
  }
  export class Column {
    constructor(
      public type: string,
      public name: string) {
      // ...
    }
  }
  export class Cell {
    constructor(public value: any) {
      // ...
    }
  }
  export class Row {
    constructor(public cells: Cell []) {
      // ...
    }
    sumCells(start: number, end: number = this.cells.length) {
      let sum = 0;
      for (let i = start; i < end; i++) {
        sum += this.cells[i].value;
      }
      return sum;
    }
  }
}

export interface BarPlotTable {

}
interface BarPlotProps extends PlotProps {
  table: Data.Table;
  isStacked: "relative" | "absolute"
}
interface BarPlotState extends PlotState {

}

let colorPool = [
  '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#b15928'
];

export class BarPlot<P extends BarPlotProps, S extends BarPlotState> extends Plot<P, S> {
  constructor(props: BarPlotProps) {
    super();
    this.state = { data: props.table } as any;
  }
  draw() {
    this.updateScales();
    this.drawBackground();
    let c = this.ctx;
    let a = new Point(0, 0);
    let table = this.props.table;
    let isRelative = this.props.isStacked === "relative";
    if (isRelative) {
      this.updateScales();
    }
    let r = this.ratio;
    let barW = 8 * r;
    let barWPadding = 1 * r;
    let maxBars = (this.device.w / (barW + barWPadding)) | 0;
    let maxRowSum = 0;
    if (!isRelative) {
      for (let i = 0; i < table.rows.length; i++) {
        let row = table.rows[i];
        maxRowSum = Math.max(maxRowSum, row.sumCells(1));
      }
      this.updateScales();
    }
    for (let i = 0; i < table.rows.length; i++) {
      let row = table.rows[i];
      let p = new Point((i % maxBars) * (barW + barWPadding), 0);
      let s = new Size(barW, 0);
      if (isRelative) {
        let rowSum = row.sumCells(1);
        for (let j = 1; j < row.cells.length; j++) {
          let cell = row.cells[j];
          let cellH = cell.value / rowSum;
          c.fillStyle = colorPool[j % colorPool.length];
          s.h = cellH;
          this.fillRect(p, s);
          p.y += s.h;
        }
      } else {
        for (let j = 1; j < row.cells.length; j++) {
          let cell = row.cells[j];
          let cellH = cell.value;
          c.fillStyle = colorPool[j % colorPool.length];
          s.h = cellH;
          this.fillRect(p, s);
          p.y += s.h;
        }
      }
    }
  }
}