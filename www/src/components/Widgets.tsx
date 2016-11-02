import * as React from "react";
import { Button, Panel, Form, FormGroup, ControlLabel, FormControl, ButtonToolbar } from "react-bootstrap";
import { } from "react-bootstrap";
import { appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile } from "../stores/Stores";
import { Analyzer } from "../analyzer";
import { Promise } from "es6-promise";

import { BarPlot, BarPlotTable, Data } from "./Plot";

declare var require: any;
let Select = require('react-select');

interface JobSelectorProps {
  jobs: Job [];
  metric: string;
  onChange?: (metric?: string, video?: string, qualitie?: number) => void;
}

export interface Option {
  label: string;
  value: string;
  disabled?: boolean;
}

export function arraysEqual<T>(a: T [], b: T []): boolean {
  if (a == b) return true;
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++)
    if (a[i] != b[i]) return false;
  return true;
}

interface AnalyzerProps {
  video: string;
  jobs: Job []
}

export class AnalyzerVideoSelectorComponent extends React.Component<AnalyzerProps, {
  jobs: Job [];
  options: { value: string, label: string } [];
  selected: { value: string, label: string } [];
}> {
  constructor(props) {
    super();
    this.state = {
      jobs: [],
      options: [],
      selected: []
    } as any;
  }
  componentWillReceiveProps(nextProps: AnalyzerProps, nextContext: any) {
    if (!arraysEqual(this.state.jobs, nextProps.jobs)) {
      this.loadOptions(nextProps.jobs);
    }
  }
  loadOptions(jobs: Job []) {
    let video = this.props.video;
    let options = [];
    jobs.forEach((job) => {
      job.loadReport().then((report) => {
        if (!report) return;
        let options = this.state.options;
        report[video].forEach((row) => {
          options.push({ value: {A: job.id + " " + row[0]} as any, label: job.id + " @ " + row[0] });
        })
        this.setState({options} as any);
      });
    });
  }
  componentWillMount() {
    this.loadOptions(this.props.jobs);
  }
  onChange(selected) {
    this.setState({selected} as any);
  }
  onAnalyzeClick() {
    // AppDispatcher.dispatch(new AnalyzeFile("http://aomanalyzer.org/bin/decoder.js", "crosswalk_30.ivf"));
  }
  onAnalyzeInTabClick() {
    AppDispatcher.dispatch(new AnalyzeFile("http://aomanalyzer.org/bin/decoder.js", "crosswalk_30.ivf"));
  }
  render() {
    let options = this.state.options;
    let selected = this.state.selected;
    return <div style={{ paddingBottom: 8, paddingTop: 4 }}>
      <div className="row">
        <div className="col-xs-6" style={{ paddingBottom: 8 }}>
          <Select multi placeholder="Select files to analyze." value={selected} options={options} onChange={this.onChange.bind(this)} />
        </div>
        <div className="col-xs-6" style={{ paddingBottom: 8 }}>
          <Button disabled={selected.length == 0} onClick={this.onAnalyzeClick.bind(this)}>Open in Analyzer</Button>{' '}
          <Button disabled={selected.length == 0} onClick={this.onAnalyzeInTabClick.bind(this)}>Open in Tabs</Button>
        </div>
      </div>
    </div>
  }
}

export class AnalyzerComponent extends React.Component<{
  decoderUrl: string;
  videoUrl: string;
}, {
  analyzer: Analyzer.Analyzer;
  interval: number;
}> {
  constructor() {
    super();
    this.state = { analyzer: null, interval: 0 };
  }
  componentWillMount() {
    this.load(this.props.decoderUrl, this.props.videoUrl);
  }
  load(decoderPath: string, videoPath: string) {
    Analyzer.Analyzer.loadDecoder(decoderPath).then((analyzer) => {
      console.info(analyzer);
      Analyzer.Analyzer.downloadFile(videoPath).then((bytes) => {
        analyzer.openFileBytes(bytes);
        this.setState({analyzer} as any);
      });
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
        <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Loading analyzer ...
      </Panel>
    }
    return <Panel header="Analyzer">
      <BarPlot width={800} height={100} table={this.getData()} isStacked="relative"/>
      <BarPlot width={800} height={100} table={this.getData()} isStacked="absolute"/>
      <BarPlot width={800} height={100} table={this.getHistogramData("blockSizeHistogram")} isStacked="relative"/>
      <BarPlot width={800} height={100} table={this.getHistogramData("predictionModeHistogram")} isStacked="relative"/>
      <div style={{ paddingBottom: 8, paddingTop: 4 }}>
        <Button onClick={this.onClick.bind(this)}>Play / Pause Video</Button>
      </div>
    </Panel>
  }
}

export class ShareComponent extends React.Component<void, void> {
  constructor() {
    super();
  }
  render() {
    let url = location.protocol + '//' + location.host + location.pathname + "?";
    url += appStore.jobs.jobs.filter(job => job.selected).map(job => {
      return "job=" + encodeURIComponent(job.id);
    }).join("&");
    return <div><div>Sharing URL</div><a className="url" href={url}>{url}</a></div>
  }
}

export class LoginComponent extends React.Component<void, {
  password: string;
}> {
  check: Promise<boolean>
  constructor() {
    super();
    let password = "";
    try {
      password = localStorage["password"] || "";
    } catch (e) {
      console.log("Couldn't read secret key from localstorage:",e);
      password = "";
    }
    this.state = {
      password: password
    };
  }
  componentWillMount() {
  }
  onInputChange(e: any) {
    this.setState({
      password: e.target.value
    } as any);
  }
  getValidationState(): "success" | "warning" | "error" {
    let password = this.state.password;
    if (password === "") {
      return "error";
    }
    return "success";
  }
  onLogin() {
    appStore.login(this.state.password).then(
      (result) => { this.forceUpdate(); },
      () => { this.forceUpdate(); }
    );
  }
  onLogout() {
    appStore.logout();
    this.forceUpdate();
  }
  render() {
    let login = <div>
      <FormGroup validationState={this.getValidationState()}>
        <ControlLabel>AWCY API Key</ControlLabel>
        <FormControl type="text" placeholder=""
          value={this.state.password} onChange={this.onInputChange.bind(this)} />
      </FormGroup>
      <FormGroup>
        <ButtonToolbar>
          <Button bsSize="small" onClick={this.onLogin.bind(this)}>Login</Button>
        </ButtonToolbar>
      </FormGroup>
    </div>
    let logout = <div>
      <FormGroup>
        <ButtonToolbar>
          <Button bsSize="small" onClick={this.onLogout.bind(this)}>Logout</Button>
        </ButtonToolbar>
      </FormGroup>
    </div>
    return appStore.isLoggedIn ? logout : login;
  }
}
