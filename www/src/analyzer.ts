import { Promise } from "es6-promise"
declare let DecoderModule: any;

export function clamp(v, a, b) {
  if (v < a) {
    v = a;
  }
  if (v > b) {
    v = b;
  }
  return v;
}
function YUV2RGB(yValue, uValue, vValue) {
  let rTmp = yValue + (1.370705 * (vValue - 128));
  let gTmp = yValue - (0.698001 * (vValue - 128)) - (0.337633 * (uValue - 128));
  let bTmp = yValue + (1.732446 * (uValue - 128));
  let r = clamp(rTmp | 0, 0, 255) | 0;
  let g = clamp(gTmp | 0, 0, 255) | 0;
  let b = clamp(bTmp | 0, 0, 255) | 0;
  return (b << 16) | (g << 8) | (r << 0);
}

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
    public names: string[]) {
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
  FS: any;
  HEAPU8: Uint8Array;
  UTF8ToString(p: number): string;
}

export class AnalyzerFrame {
  json: Object;
  accounting: Accounting;
  blockSizeHist: Histogram;
  transformSizeHist: Histogram;
  transformTypeHist: Histogram;
  predictionModeHist: Histogram;
  skipHist: Histogram;
  imageData: ImageData;
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
    this.buffer = buffer;
    this.native.FS.writeFile("/tmp/input.ivf", buffer, { encoding: "binary" });
    this.native._open_file();
  }

  setLayers(layers) {
    this.native._set_layers(layers);
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
      frames.push(frame);
      this.frames.push(frame);
    }
    if (this.shouldReadImageData) {
      frames[frames.length - 1].imageData = this.readImage();
    }
    return frames;
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

    let showY = !!Yp;
    let showU = !!Up;
    let showV = !!Vp;

    let p = 0;
    let bgr = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bitDepth == 10) {
          let Y = 128;
          if (showY) {
            p = Yp + Math.imul(Ys, y) + (x << 1);
            Y = (H[p] + (H[p + 1] << 8)) >> 2;
          }
          let U = 128;
          if (showU) {
            p = Up + Math.imul(y >> 1, Us) + ((x >> 1) << 1);
            U = (H[p] + (H[p + 1] << 8)) >> 2;
          }
          let V = 128;
          if (showV) {
            p = Vp + Math.imul(y >> 1, Vs) + ((x >> 1) << 1);
            V = (H[p] + (H[p + 1] << 8)) >> 2;
          }
          bgr = YUV2RGB(Y, U, V);
        } else {
          let Y = showY ? H[Yp + Math.imul(y, Ys) + x] : 128;
          let U = showU ? H[Up + Math.imul(y >> 1, Us) + (x >> 1)] : 128;
          let V = showV ? H[Vp + Math.imul(y >> 1, Vs) + (x >> 1)] : 128;
          bgr = YUV2RGB(Y, U, V);
        }

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
      }
      s.onerror = function () {
        reject();
      };
      s.setAttribute('src', url);
      document.body.appendChild(s);
    });
  }
}
