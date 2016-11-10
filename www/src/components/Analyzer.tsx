import * as React from "react";
import { Button, Panel, Form, FormGroup, ControlLabel, FormControl, ButtonToolbar } from "react-bootstrap";
import { } from "react-bootstrap";
import { appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile } from "../stores/Stores";
import { Analyzer } from "../analyzer";
import { Promise } from "es6-promise";

import { BarPlot, BarPlotTable, Data } from "./Plot";

export class AnalyzerComponent extends React.Component<{
  decoderUrl: string;
  videoUrl: string;
}, {
  analyzer: Analyzer.Analyzer;
  analyzerFailedToLoad: boolean | null
  interval: number;
}> {
  constructor() {
    super();
    this.state = {
      analyzer: null,
      analyzerFailedToLoad: null,
      interval: 0
    };
  }
  componentWillMount() {
    this.load(this.props.decoderUrl, this.props.videoUrl);
  }
  load(decoderPath: string, videoPath: string) {
    Analyzer.Analyzer.loadDecoder(decoderPath).then((analyzer) => {
      console.info(analyzer);
      Analyzer.Analyzer.downloadFile(videoPath).then((bytes) => {
        analyzer.openFileBytes(bytes);
        this.setState({analyzer, analyzerFailedToLoad: false} as any);
      }).catch(() => {
        this.setState({analyzerFailedToLoad: true} as any);
      });
    }).catch(() => {
      this.setState({analyzerFailedToLoad: true} as any);
    });
  }
  onClick() {
    let analyzer = this.state.analyzer;
    if (this.state.interval) {
      clearInterval(this.state.interval);
      this.setState({interval: 0} as any);
      return;
    }
    let interval = setInterval(() =>{
      analyzer.readFrame().then((frame) => {
        if (!frame) {
          clearInterval(this.state.interval);
          this.setState({interval: 0} as any);
          return;
        }
        this.forceUpdate();
      });
    }, 16);
    this.setState({interval} as any);
  }
  getData(): Data.Table {
    let table = new Data.Table();
    let analyzer = this.state.analyzer;
    if (!analyzer) {
      return table;
    }
    table.addColumn("string", "Frame");
    let names = Analyzer.Accounting.getSortedSymbolNames(analyzer.frames.map(frame => frame.accounting));
    names.forEach(name => {
      table.addColumn("number", name)
    });

    let rows = [];
    analyzer.frames.forEach((frame, i) => {
      let row = [i];
      let symbols = frame.accounting.createFrameSymbols();
      names.forEach(name => {
        let symbol = symbols[name];
        row.push(symbol ? symbol.bits : 0);
      });
      rows.push(row);
    });
    table.addRows(rows);
    return table;
  }
  getHistogramData(histogram: "predictionModeHistogram" | "blockSizeHistogram"): Data.Table {
    var table = new Data.Table();
    let analyzer = this.state.analyzer;
    if (!analyzer) {
      return table;
    }
    let e = null;
    if (histogram === "predictionModeHistogram") {
      e = Analyzer.PredictionMode;
    } else if (histogram === "blockSizeHistogram") {
      e = Analyzer.BlockSize;
    }
    table.addColumn("string", "Frame");
    for (let i = 0; i <= e.LAST; i++) {
      table.addColumn('number', e[i]);
    }
    let rows = [];
    analyzer.frames.forEach((frame, i) => {
      let row = [i];
      for (let j = 0; j <= e.LAST; j++) {
        row.push(frame[histogram].counts[j]);
      }
      rows.push(row);
    });
    table.addRows(rows);
    return table;
  }
  render() {
    console.debug("Rendering Analyzer");
    let analyzer = this.state.analyzer;
    if (!analyzer) {
      return <Panel header="Analyzer">
        { this.state.analyzerFailedToLoad ?
          <span><span className="glyphicon glyphicon-warning-sign"></span> Analyzer failed to load. </span> :
          <span><span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Loading analyzer ... </span>
        }
      </Panel>
    }
    return <Panel header="Analyzer">
      <BarPlot width="100%" height={256} table={this.getData()} isStacked="relative"/>

      <div style={{ paddingBottom: 8, paddingTop: 4 }}>
        <Button onClick={this.onClick.bind(this)}>Play / Pause Video</Button>
      </div>
    </Panel>

    // <BarPlot width={800} height={100} table={this.getData()} isStacked="absolute"/>
    //   <BarPlot width={800} height={100} table={this.getHistogramData("blockSizeHistogram")} isStacked="relative"/>
    //   <BarPlot width={800} height={100} table={this.getHistogramData("predictionModeHistogram")} isStacked="relative"/>
  }
}