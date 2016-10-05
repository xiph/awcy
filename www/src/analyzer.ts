import { Promise } from "es6-promise"
declare let DecoderModule: any;

export module Analyzer {
  export enum PredictionMode {
    DC_PRED = 0,   // Average of above and left pixels
    V_PRED = 1,   // Vertical
    H_PRED = 2,   // Horizontal
    D45_PRED = 3,   // Directional 45  deg = round(arctan(1/1) * 180/pi)
    D135_PRED = 4,   // Directional 135 deg = 180 - 45
    D117_PRED = 5,   // Directional 117 deg = 180 - 63
    D153_PRED = 6,   // Directional 153 deg = 180 - 27
    D207_PRED = 7,   // Directional 207 deg = 180 + 27
    D63_PRED = 8,   // Directional 63  deg = round(arctan(2/1) * 180/pi)
    TM_PRED = 9,   // True-motion
    NEARESTMV = 10,
    NEARMV = 11,
    ZEROMV = 12,
    NEWMV = 13,
    LAST = 13
  }

  export enum BlockSize {
    BLOCK_4X4 = 0,
    BLOCK_4X8 = 1,
    BLOCK_8X4 = 2,
    BLOCK_8X8 = 3,
    BLOCK_8X16 = 4,
    BLOCK_16X8 = 5,
    BLOCK_16X16 = 6,
    BLOCK_16X32 = 7,
    BLOCK_32X16 = 8,
    BLOCK_32X32 = 9,
    BLOCK_32X64 = 10,
    BLOCK_64X32 = 11,
    BLOCK_64X64 = 12,
    LAST = 12
  }

  export interface Enum {
    [index: number]: string;
    LAST: number;
  }

  enum MIProperty {
    GET_MI_MV,
    GET_MI_MV_REFERENCE_FRAME,
    GET_MI_MODE,
    GET_MI_SKIP,
    GET_MI_BLOCK_SIZE,
    GET_MI_TRANSFORM_TYPE,
    GET_MI_TRANSFORM_SIZE,
    GET_MI_DERING_GAIN,
    GET_MI_BITS,
    GET_MI_AC_Y_DEQUANT,
    GET_MI_DC_Y_DEQUANT,
    GET_MI_AC_UV_DEQUANT,
    GET_MI_DC_UV_DEQUANT
  }

  enum AccountingProperty {
    GET_ACCCOUNTING_SYMBOL_COUNT,
    GET_ACCCOUNTING_SYMBOL_NAME,
    GET_ACCCOUNTING_SYMBOL_BITS,
    GET_ACCCOUNTING_SYMBOL_SAMPLES,
    GET_ACCCOUNTING_SYMBOL_CONTEXT_X,
    GET_ACCCOUNTING_SYMBOL_CONTEXT_Y
  }

  export class AccountingSymbol {
    constructor(public name: string, public bits: number, public samples: number, public x: number, public y: number) {
      // ...
    }
  }

  type AccountingSymbolMap = { [name: string]: AccountingSymbol };

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

  export class Histogram<T> {
    counts: Uint32Array;
    constructor(length: number) {
      this.counts = new Uint32Array(length);
    }
  }

  // export class FrameModeMetrics {
  //   counts: Uint32Array;
  //   constructor() {
  //     this.counts = new Uint32Array(AnalyzerPredictionMode.NEWMV + 1);
  //   }
  //   static makeFrameModeDataTable(metrics: FrameModeMetrics [], count: number) {
  //     var data = new google.visualization.DataTable();
  //     data.addColumn('string', "Frame");
  //     for (let i = 0; i <= AnalyzerPredictionMode.NEWMV; i++) {
  //       data.addColumn('number', AnalyzerPredictionMode[i]);
  //     }
  //     let offset = Math.max(0, metrics.length - count);
  //     metrics = metrics.slice(offset)
  //     for (let i = 0; i < metrics.length; i++) {
  //       let row: any [] = ["Frame " + (i + offset)];
  //       for (let j = 0; j <= AnalyzerPredictionMode.NEWMV; j++) {
  //         row.push(metrics[i].counts[j]);
  //       }
  //       data.addRows([row]);
  //     }
  //     return data;
  //   }
  // }

  interface Internal {
    _read_frame(): number;
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

    // _get_property(p: Property): number;
    _get_accounting_property(p: AccountingProperty, i: number): number;
    _get_mi_property(p: MIProperty, mi_col: number, mi_row: number, i: number): number;

    _get_predicted_plane_buffer(pli: number): number;
    _get_predicted_plane_stride(pli: number): number;

    FS: any;
    HEAPU8: Uint8Array;
    UTF8ToString(p: number): string;
  }

  class GridSize {
    constructor(public cols: number, public rows: number) {
      // ...
    }
  }

  export class AnalyzerFrame {
    accounting: Accounting;
    blockSizeHistogram: Histogram<BlockSize>;
    predictionModeHistogram: Histogram<PredictionMode>;
  }

  export class Analyzer {
    file: string;
    decoder: string;
    native: Internal;
    HEAPU8: Uint8Array;
    buffer: Uint8Array;
    frameNumber: number = -1;
    lastDecodeFrameTime: number = 0;
    frames: AnalyzerFrame[] = [];
    // frameErrors: ErrorMetrics [] = [];
    // frameModes: FrameModeMetrics [] = [];
    // frameBlockSizes: FrameBlockSizeMetrics [] = [];
    // y4mFile: Y4MFile;
    constructor(native: Internal) {
      this.native = native;
      this.HEAPU8 = native.HEAPU8;
      this.buffer = new Uint8Array(0);
    }

    openFileBytes(buffer: Uint8Array) {
      this.buffer = buffer;
      this.native.FS.writeFile("/tmp/input.ivf", buffer, { encoding: "binary" });
      this.native._open_file();
    }

    readFrame(): Promise<AnalyzerFrame> {
      return Promise.resolve(this.readFrameSync());
    }
    readFrameSync(): AnalyzerFrame {
      let s = performance.now();
      if (this.native._read_frame() != 0) {
        return null;
      }
      this.frameNumber++;
      this.lastDecodeFrameTime = performance.now() - s;
      let frame = new AnalyzerFrame();
      frame.accounting = this.getAccounting();
      frame.blockSizeHistogram = this.getBlockSizeHistogram();
      frame.predictionModeHistogram = this.getPredictionModeHistogram();
      this.frames[this.frameNumber] = frame;
      return frame;
    }

    getAccountingProperty(p: AccountingProperty, i: number = 0) {
      return this.native._get_accounting_property(p, i);
    }
    getString(i: number): string {
      return this.native.UTF8ToString(i);
    }
    getMIProperty(p: MIProperty, mi_col: number, mi_row: number, i: number = 0) {
      return this.native._get_mi_property(p, mi_col, mi_row, i);
    }
    getAccounting(): Accounting {
      var accounting = new Accounting();
      let count = this.getAccountingProperty(AccountingProperty.GET_ACCCOUNTING_SYMBOL_COUNT);
      let nameMap = [];
      for (let i = 0; i < count; i++) {
        let nameAddress = this.getAccountingProperty(AccountingProperty.GET_ACCCOUNTING_SYMBOL_NAME, i);
        if (nameMap[nameAddress] === undefined) {
          nameMap[nameAddress] = this.getString(nameAddress);
        }
        let name = nameMap[nameAddress];
        let bits = this.getAccountingProperty(AccountingProperty.GET_ACCCOUNTING_SYMBOL_BITS, i);
        let samples = this.getAccountingProperty(AccountingProperty.GET_ACCCOUNTING_SYMBOL_SAMPLES, i);
        let x = this.getAccountingProperty(AccountingProperty.GET_ACCCOUNTING_SYMBOL_CONTEXT_X, i);
        let y = this.getAccountingProperty(AccountingProperty.GET_ACCCOUNTING_SYMBOL_CONTEXT_Y, i);
        accounting.symbols.push(new AccountingSymbol(name, bits, samples, x, y));
      }
      return accounting;
    }
    getMIGridSize(): GridSize {
      let v = this.native._get_mi_cols_and_rows();
      let cols = v >> 16;
      let rows = this.native._get_mi_cols_and_rows() & 0xFF;
      return new GridSize(cols, rows);
    }
    getPredictionModeHistogram(): Histogram<PredictionMode> {
      let metrics = new Histogram<PredictionMode>(PredictionMode.LAST + 1);
      let {cols, rows} = this.getMIGridSize();
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          metrics.counts[this.getMIProperty(MIProperty.GET_MI_MODE, c, r)]++;
        }
      }
      return metrics;
    }
    getBlockSizeHistogram(): Histogram<BlockSize> {
      let metrics = new Histogram<PredictionMode>(BlockSize.LAST + 1);
      let {cols, rows} = this.getMIGridSize();
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          metrics.counts[this.getMIProperty(MIProperty.GET_MI_BLOCK_SIZE, c, r)]++;
        }
      }
      return metrics;
    }
    static downloadFile(url: string): Promise<Uint8Array> {
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
            return;
          }
          resolve(new Uint8Array(this.response));
        });
      });
    }

    static loadDecoder(url: string): Promise<Analyzer> {
      return new Promise((resolve, reject) => {
        let s = document.createElement('script');
        let self = this;
        s.onload = function () {
          var aom = null;
          var Module = {
            noExitRuntime: true,
            preRun: [],
            postRun: [function () {
              console.info(`Loaded Decoder: ${url}.`);
            }],
            memoryInitializerPrefixURL: "bin/",
            arguments: ['input.ivf', 'output.raw']
          };
          resolve(new Analyzer(DecoderModule(Module)));
        }
        s.setAttribute('src', url);
        document.body.appendChild(s);
      });
    }
  }
}
