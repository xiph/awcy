import { Promise } from "es6-promise"
declare let DecoderModule: any;


export const COLORS_OLD = [
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

export const COLORS = ["#126800",
"#3e2dd5",
"#87ba00",
"#305eff",
"#8eda53",
"#37007f",
"#e1c633",
"#0055d0",
"#ffab28",
"#00267a",
"#fc6800",
"#016fc7",
"#6e9000",
"#b2007c",
"#00ae63",
"#d80048",
"#00caed",
"#a31500",
"#02a4e3",
"#ff4553",
"#003d5b",
"#ff6c7e",
"#2a3700",
"#ff95c5",
"#a9d19d",
"#5e0060",
"#8f5600",
"#dcbaed",
"#511500",
"#f3b9a2",
"#5b0022",
"#92004f"];


export const HEAT_COLORS = [];
function generateHeatColors() {
  function color(value) {
    var h = (1.0 - value) * 240;
    return "hsl(" + h + ", 100%, 50%)";
  }
  for (let i = 0; i < 256; i++) {
    HEAT_COLORS.push(color(i / 256));
  }
}
generateHeatColors();

export function clamp(v, a, b) {
  if (v < a) {
    v = a;
  }
  if (v > b) {
    v = b;
  }
  return v;
}

let YUV2RGB_TABLE = new Uint32Array(256 * 256 * 256);

function YUV2RGB(y, u, v) {
  return YUV2RGB_TABLE[(y << 16) | (u << 8) | v];
}

function computeYUV2RGB(y, u, v) {
  let rTmp = y + (1.370705 * (v - 128));
  let gTmp = y - (0.698001 * (v - 128)) - (0.337633 * (u - 128));
  let bTmp = y + (1.732446 * (u - 128));
  let r = clamp(rTmp | 0, 0, 255) | 0;
  let g = clamp(gTmp | 0, 0, 255) | 0;
  let b = clamp(bTmp | 0, 0, 255) | 0;
  return (b << 16) | (g << 8) | (r << 0);
}

function buildYUVTable() {
  for (let y = 0; y < 256; y++) {
    for (let u = 0; u < 256; u++) {
      for (let v = 0; v < 256; v++) {
        YUV2RGB_TABLE[(y << 16) | (u << 8) | v] = computeYUV2RGB(y, u, v);
      }
    }
  }
}

buildYUVTable();

export class AccountingSymbol {
  constructor(public name: string, public bits: number, public samples: number, public x: number, public y: number) {
    // ...
  }
}

export type AccountingSymbolMap = { [name: string]: AccountingSymbol };

export class Accounting {
  symbols: AccountingSymbol[] = null;
  frameSymbols: AccountingSymbolMap = null;
  constructor(symbols: AccountingSymbol[] = []) {
    this.symbols = symbols;
  }
  createFrameSymbols() {
    if (this.frameSymbols) {
      return this.frameSymbols;
    }
    this.frameSymbols = Object.create(null);
    this.frameSymbols = Accounting.flatten(this.symbols);
    return this.frameSymbols;
  }
  countCache: {[filter: string]: {blocks: number [][], total: number, leftover: number}} = {};
  countBits(filter: string): {blocks: number [][], total: number} {
    if (!filter) {
      filter = "__none__";
    }
    if (this.countCache[filter]) {
      return this.countCache[filter];
    }
    let blocks = [];
    let total = 0;
    let leftover = 0;
    this.symbols.forEach(symbol => {
      if (filter !== "__none__" && symbol.name != filter) {
        return;
      }
      let {x, y} = symbol;
      if (x < 0 || y < 0) {
        leftover += symbol.bits;
        return;
      }
      if (!blocks[y]) {
        blocks[y] = [];
      }
      if (blocks[y][x] === undefined) {
        blocks[y][x] = 0;
      }
      blocks[y][x] += symbol.bits;
      total += symbol.bits;
    });
    return this.countCache[filter] = {blocks: blocks, total, leftover};
  }
  createBlockSymbols(c: number, r: number) {
    return Accounting.flatten(this.symbols.filter(symbol => {
      return symbol.x === c && symbol.y === r;
    }));
  }
  static flatten(sybmols: AccountingSymbol[]): AccountingSymbolMap {
    let map = Object.create(null);
    sybmols.forEach(symbol => {
      let s = map[symbol.name];
      if (!s) {
        s = map[symbol.name] = new AccountingSymbol(symbol.name, 0, 0, symbol.x, symbol.y);
      }
      s.bits += symbol.bits;
      s.samples += symbol.samples;
    });
    let ret = Object.create(null);
    let names = [];
    for (let name in map) names.push(name);
    // Sort by bits.
    names.sort((a, b) => map[b].bits - map[a].bits);
    names.forEach(name => {
      ret[name] = map[name];
    });
    return ret;
  }

  static getSortedSymbolNames(accountings: Accounting[]): string[] {
    let set = {};
    accountings.forEach(accounting => {
      let frameSymbols = accounting.createFrameSymbols();
      for (let name in frameSymbols) {
        set[name] = undefined;
      }
    });
    let names = Object.keys(set);
    names.sort();
    return names;
  }
}

export class Histogram {
  constructor(
    public counts: { [id: string]: number },
    public names: { [id: string]: number }) {
    // ...
  }
}

interface Internal {
  _read_frame(): number;
  _get_bit_depth(): number;
  _get_plane(pli: number): number;
  _get_plane_stride(pli: number): number;
  _get_plane_width(pli: number): number;
  _get_plane_height(pli: number): number;
  _get_mi_cols_and_rows(): number;
  _get_tile_cols_and_rows_log2(): number;
  _get_frame_count(): number;
  _get_frame_width(): number;
  _get_frame_height(): number;
  _open_file(): number;
  _set_layers(layers: number): number;
  _get_aom_codec_build_config(): number;
  FS: any;
  HEAPU8: Uint8Array;
  UTF8ToString(p: number): string;
}

export class AnalyzerFrame {
  json: {
    frameType: number;
    showFrame: number;
    baseQIndex: number;
    clpfSize: number;
    clpfStrengthY: number;
  };
  accounting: Accounting;
  blockSizeHist: Histogram;
  transformSizeHist: Histogram;
  transformTypeHist: Histogram;
  predictionModeHist: Histogram;
  skipHist: Histogram;
  image: HTMLCanvasElement;
  config: string;
}

function getAccountingFromJson(json: any, name: string): Accounting {
  var accounting = new Accounting();
  if (json[name]) {
    let names = json[name + "Map"];
    let symbols = [];
    let x = -1, y = -1;
    for (let i = 0; i < json.symbols.length; i++) {
      let symbol = json.symbols[i];
      if (symbol.length == 2) {
        x = symbol[0];
        y = symbol[1];
      } else {
        let name = symbol[0];
        let bits = symbol[1];
        let samples = symbol[2];
        symbols.push(new AccountingSymbol(names[name], bits, samples, x, y));
      }
    }
    accounting.symbols = symbols;
  }
  return accounting;
}

function getHistogramFromJson(json: any, name: string): Histogram {
  if (!json[name]) {
    return null;
  }
  let counts = {};
  json[name].forEach(row => {
    row.forEach(v => {
      if (counts[v] === undefined) {
        counts[v] = 0;
      }
      counts[v]++;
    });
  });
  return new Histogram(counts, json[name + "Map"]);
}

function readFrameFromJson(json): AnalyzerFrame {
  let frame = new AnalyzerFrame();
  frame.json = json;
  frame.accounting = getAccountingFromJson(json, "symbols");
  frame.blockSizeHist = getHistogramFromJson(json, "blockSize");
  frame.skipHist = getHistogramFromJson(json, "skip");
  frame.transformSizeHist = getHistogramFromJson(json, "transformSize");
  frame.transformTypeHist = getHistogramFromJson(json, "transformType");
  frame.predictionModeHist = getHistogramFromJson(json, "mode");
  return frame;
}

export function downloadFile(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (url.startsWith(localFileProtocol)) {
      let localFile = url.substring(localFileProtocol.length);
      let file = localFiles[localFile];
      if (file) {
        resolve(new Uint8Array(file));
        return;
      } else {
        reject(`Local file "${localFile}" does not exist.`);
        return;
      }
    }
    let xhr = new XMLHttpRequest();
    let self = this;
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.send();
    xhr.addEventListener("progress", (e) => {
      let progress = (e.loaded / e.total) * 100;
    });
    xhr.addEventListener("load", function () {
      if (xhr.status != 200) {
        reject();
        return;
      }
      resolve(new Uint8Array(this.response));
    });
  });
}

export function downloadJson(url: string): Promise<Object> {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    let self = this;
    xhr.open("GET", url, true);
    xhr.responseType = "json";
    xhr.send();
    xhr.addEventListener("progress", (e) => {
      let progress = (e.loaded / e.total) * 100;
    });
    xhr.addEventListener("load", function () {
      if (xhr.status != 200) {
        reject();
        return;
      }
      resolve(this.response);
    });
  });
}

export function loadFramesFromJson(url: string): Promise<AnalyzerFrame[]> {
  return new Promise((resolve, reject) => {
    downloadJson(url).then((json: any) => {
      resolve(json.filter(frame => !!frame).map(frame => {
        return readFrameFromJson(frame);
      }));
    });
  });
}

export class Size {
  constructor(public w: number, public h: number) {
    // ...
  }
  clone() {
    return new Size(this.w, this.h);
  }
  equals(other: Size) {
    return this.w == other.w || this.h == other.h;
  }
  area(): number {
    return this.w * this.h;
  }
  multiplyScalar(scalar: number) {
    if (isFinite(scalar)) {
      this.w *= scalar;
      this.h *= scalar;
    } else {
      this.w = 0;
      this.h = 0;
    }
    return this;
  }
  roundUpToMultipleOfLog2(roundToLog2) {
    let roundTo = 1 << roundToLog2;
    this.w = (this.w + roundTo - 1) & ~(roundTo - 1);
    this.h = (this.h + roundTo - 1) & ~(roundTo - 1);
    return this;
  }
}

export class Rectangle {
  constructor(public x: number, public y: number, public w: number, public h: number) {
    // ...
  }
  static createRectangleCenteredAtPoint(v: Vector, w: number, h: number) {
    return new Rectangle(v.x - w / 2, v.y - h / 2, w, h);
  }
  static createRectangleFromSize(size: Size) {
    return new Rectangle(0, 0, size.w, size.h);
  }
  set(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    return this;
  }
  containsPoint(point: Vector): boolean {
    return (point.x >= this.x) &&
      (point.x < this.x + this.w) &&
      (point.y >= this.y) &&
      (point.y < this.y + this.h);
  }
  getCenter(): Vector {
    return new Vector(this.x + this.w / 2, this.y + this.h / 2);
  }
  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.w, this.h);
  }
  multiplyScalar(scalar: number) {
    if (isFinite(scalar)) {
      this.x *= scalar;
      this.y *= scalar;
      this.w *= scalar;
      this.h *= scalar;
    } else {
      this.x = 0;
      this.y = 0;
      this.w = 0;
      this.h = 0;
    }
    return this;
  }
}

export class Vector {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  set(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  lerp(v: Vector, alpha: number) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    return this;
  }
  clone(): Vector {
    return new Vector(this.x, this.y);
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  distanceTo(v: Vector) {
    let x = this.x - v.x;
    let y = this.y - v.y;
    return Math.sqrt(x * x + y * y);
  }
  normalize() {
    return this.divideScalar(this.length());
  }
  multiplyScalar(scalar) {
    if (isFinite(scalar)) {
      this.x *= scalar;
      this.y *= scalar;
    } else {
      this.x = 0;
      this.y = 0;
    }
    return this;
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  snap() {
    // TODO: Snap to nearest pixel
    this.x = this.x | 0;
    this.y = this.y | 0;
    return this;
  }
  sub(v: Vector): Vector {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  add(v: Vector): Vector {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  clampLength(min: number, max: number) {
    let length = this.length();
    this.multiplyScalar(Math.max(min, Math.min(max, length)) / length);
    return this;
  }
  toString(): string {
    return this.x + "," + this.y;
  }
}

export class GridSize {
  constructor(public cols: number, public rows: number) {
    // ...
  }
}

export class Decoder {
  file: string;
  decoder: string;
  nativeModule: {
    lastDecodedFrameJson: Object;
  };
  native: Internal;
  HEAPU8: Uint8Array;
  buffer: Uint8Array;
  lastDecodeFrameTime: number = 0;
  frames: AnalyzerFrame[] = [];

  frameRate: number = 30;
  frameSize: Size = null;
  frameCanvas: HTMLCanvasElement = null;
  frameContext: CanvasRenderingContext2D = null;

  /** Whether to read image data after decoding a frame. */
  shouldReadImageData: boolean = true;

  constructor(nativeModule) {
    this.nativeModule = nativeModule;
    this.native = DecoderModule(nativeModule);
    this.HEAPU8 = this.native.HEAPU8;
    this.buffer = new Uint8Array(0);
  }

  ensureFrameCanvas() {
    if (this.frameSize) {
      return;
    }
    this.frameSize = new Size(this.native._get_frame_width(), this.native._get_frame_height());
    this.frameCanvas = document.createElement("canvas");
    this.frameContext = this.frameCanvas.getContext("2d");
    this.frameCanvas.width = this.frameSize.w;
    this.frameCanvas.height = this.frameSize.h;
  }

  openFileBytes(buffer: Uint8Array) {
    this.frameRate = buffer[16] | buffer[17] << 24 | buffer[18] << 16 | buffer[19] << 24;
    this.buffer = buffer;
    this.native.FS.writeFile("/tmp/input.ivf", buffer, { encoding: "binary" });
    this.native._open_file();
  }

  setLayers(layers) {
    this.native._set_layers(layers);
  }

  getBuildConfig() {
    if (!this.native._get_aom_codec_build_config) {
      return "";
    }
    return (this.nativeModule as any).UTF8ToString(this.native._get_aom_codec_build_config());
  }

  readFrame(): Promise<AnalyzerFrame[]> {
    return Promise.resolve(this.readFrameSync());
  }

  readFrameSync(): AnalyzerFrame[] {
    let s = performance.now();
    if (this.native._read_frame() != 0) {
      return null;
    }
    this.lastDecodeFrameTime = performance.now() - s;
    let o = this.nativeModule.lastDecodedFrameJson as Object[];
    let frames: AnalyzerFrame[] = [];
    for (let i = 0; i < o.length - 1; i++) {
      let json = o[i];
      let frame = readFrameFromJson(json);
      frame.config = this.getBuildConfig();
      frames.push(frame);
      this.frames.push(frame);
    }
    if (this.shouldReadImageData) {
      frames[frames.length - 1].image = this.makeCanvas(this.readImage());
    }
    return frames;
  }

  makeCanvas(imageData: ImageData): HTMLCanvasElement {
    var canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    var ctx = canvas.getContext("2d");
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  readImage(): ImageData {
    this.ensureFrameCanvas();
    let Yp = this.native._get_plane(0);
    let Ys = this.native._get_plane_stride(0);
    let Up = this.native._get_plane(1);
    let Us = this.native._get_plane_stride(1);
    let Vp = this.native._get_plane(2);
    let Vs = this.native._get_plane_stride(2);
    let bitDepth = this.native._get_bit_depth();
    let imageData = this.frameContext.createImageData(this.frameSize.w, this.frameSize.h);
    this.fillImageData(imageData, this.native.HEAPU8, Yp, Ys, Up, Us, Vp, Vs, bitDepth);
    return imageData;
  }

  fillImageData(imageData: ImageData, H: Uint8Array, Yp, Ys, Up, Us, Vp, Vs, bitDepth) {
    let I = imageData.data;
    let w = this.frameSize.w;
    let h = this.frameSize.h;

    let p = 0;
    let bgr = 0;
    if (bitDepth == 10) {
      for (let y = 0; y < h; y++) {
        let yYs = y * Ys;
        let yUs = (y >> 1) * Us;
        let yVs = (y >> 1) * Vs;
        for (let x = 0; x < w; x++) {
          p = Yp + yYs + (x << 1);
          let Y = (H[p] + (H[p + 1] << 8)) >> 2;
          p = Up + yUs + ((x >> 1) << 1);
          let U = (H[p] + (H[p + 1] << 8)) >> 2;
          p = Vp + yVs + ((x >> 1) << 1);
          let V = (H[p] + (H[p + 1] << 8)) >> 2;
          bgr = YUV2RGB(Y, U, V);
          let r = (bgr >> 0) & 0xFF;
          let g = (bgr >> 8) & 0xFF;
          let b = (bgr >> 16) & 0xFF;
          let index = (Math.imul(y, w) + x) << 2;
          I[index + 0] = r;
          I[index + 1] = g;
          I[index + 2] = b;
          I[index + 3] = 255;
        }
      }
    } else {
      for (let y = 0; y < h; y++) {
        let yYs = y * Ys;
        let yUs = (y >> 1) * Us;
        let yVs = (y >> 1) * Vs;
        for (let x = 0; x < w; x++) {
          let Y = H[Yp + yYs + x];
          let U = H[Up + yUs + (x >> 1)];
          let V = H[Vp + yVs + (x >> 1)];
          bgr = YUV2RGB(Y, U, V);
          let r = (bgr >> 0) & 0xFF;
          let g = (bgr >> 8) & 0xFF;
          let b = (bgr >> 16) & 0xFF;
          let index = (Math.imul(y, w) + x) << 2;
          I[index + 0] = r;
          I[index + 1] = g;
          I[index + 2] = b;
          I[index + 3] = 255;
        }
      }
    }
  }

  static loadDecoder(url: string): Promise<Decoder> {
    return new Promise((resolve, reject) => {
      let s = document.createElement('script');
      let self = this;
      s.onload = function () {
        var aom = null;
        var Module = {
          lastDecodedFrameJson: null,
          noExitRuntime: true,
          noInitialRun: true,
          preRun: [],
          postRun: [function () {
            console.info(`Loaded Decoder: ${url}.`);
          }],
          memoryInitializerPrefixURL: "bin/",
          arguments: ['input.ivf', 'output.raw'],
          on_frame_decoded_json: function (json) {
            Module.lastDecodedFrameJson = JSON.parse("[" + (Module as any).UTF8ToString(json) + "null]");
          }
        };
        resolve(new Decoder(Module));
      };
      s.onerror = function () {
        reject();
      };
      if (url.startsWith(localFileProtocol)) {
        let localFile = url.substring(localFileProtocol.length);
        let file = localFiles[localFile];
        if (!file) {
          reject(`Local file "${localFile}" does not exist.`);
          return;
        }
        s.textContent = file + ";\ndocument.currentScript.onload();";
      } else {
        s.setAttribute('src', url);
      }
      document.body.appendChild(s);
    });
  }
}

export let localFileProtocol = "local://";
export let localFiles = {};
