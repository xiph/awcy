import * as React from "react";
import { Button, Panel, Form, FormGroup, ControlLabel, FormControl } from "react-bootstrap";
import { } from "react-bootstrap";
import { AppStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile } from "../stores/Stores";
import { Analyzer } from "../analyzer";

import { BarPlot, BarPlotTable, Data } from "./Plot";

declare var require: any;
let Select = require('react-select');

interface JobSelectorProps {
  jobs: Job [];
  metrics: string [];
  onChange?: (metrics?: string [], videos?: string [], qualities?: number[]) => void;
}

export interface Option {
  label: string;
  value: string;
  disabled?: boolean;
}

function arraysEqual<T>(a: T [], b: T []): boolean {
  if (a == b) return true;
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++)
    if (a[i] != b[i]) return true;
  return false
}

export class JobSelectorComponent extends React.Component<JobSelectorProps, {
  availableJobs: Job [];
  jobs: Option [];
  videos: Option [];
  metrics: Option [];
  qualities: Option [];
}> {
  constructor() {
    super();
    this.state = {
      availableJobs: [],
      jobs: [],
      metrics: [],
      videos: [],
      qualities: []
    };
  }
  componentWillReceiveProps(nextProps: JobSelectorProps, nextContext: any) {
    if (!arraysEqual(this.state.availableJobs, nextProps.jobs)) {
      this.resetJobs(nextProps.jobs.slice(0));
    }
  }
  resetJobs(availableJobs: Job []) {
    let jobs = availableJobs.map(job => {
      return { value: job.id, label: job.id };
    });
    this.setState({availableJobs, jobs} as any);
  }
  componentWillMount() {
    this.resetJobs(this.props.jobs.slice(0));
    let metrics = this.props.metrics.map(metric => {
      return { value: metric, label: metric };
    });
    this.setState({metrics} as any);
  }
  getJob(id: string): Job {
    return this.props.jobs.find(job => job.id === id);
  }
  onChange() {
    if (!this.props.onChange) {
      return;
    }
    this.props.onChange(
      this.state.metrics.map(option => option.value),
      this.state.videos.map(option => option.value),
      this.state.qualities.map(option => Number(option.value))
    );
  }
  onChangeMetrics(metrics) {
    this.setState({metrics} as any, () => {
      this.onChange();
    });
  }
  onChangeVideos(videos) {
    this.setState({videos} as any, () => {
      this.onChange();
    });
  }
  onChangeQualities(qualities) {
    this.setState({qualities} as any, () => {
      this.onChange();
    });
  }
  render() {
    console.debug("Rendering Job Selector");
    let allJobs = [];
    let allVideos = [];
    let metrics = metricNames.map(name => {
      return { value: name, label: name };
    });
    let jobs = this.props.jobs;
    let videos = Object.keys(jobs[0].report).map(name => {
      return { value: name, label: name };
    });
    let qualities = jobs[0].report["Total"].map(row => {
      return { value: row[0], label: row[0] };
    });
    return <div>
      <div className="row">
        <div className="col-xs-12">
          <div className="row">
            <div className="col-xs-4">
              <div className="selectTitle">Metrics</div>
              <Select multi value={this.state.metrics} options={metrics} onChange={this.onChangeMetrics.bind(this)}/>
            </div>
            <div className="col-xs-4">
              <div className="selectTitle">Videos</div>
              <Select multi value={this.state.videos} options={videos} onChange={this.onChangeVideos.bind(this)}/>
            </div>
            <div className="col-xs-4">
              <div className="selectTitle">Qualities</div>
              <Select multi value={this.state.qualities} options={qualities} onChange={this.onChangeQualities.bind(this)}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  }
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

export class ShareComponent extends React.Component<{
  store: AppStore;
}, {

}> {
  constructor() {
    super();
    this.state = { };
  }
  componentWillMount() {
  }
  render() {
    let url = location.protocol + '//' + location.host + location.pathname + "?";
    url +=  this.props.store.selectedJobs.jobs.map(job => {
      return "job=" + encodeURIComponent(job.id);
    }).join("&");
    return <div><div>Sharing URL</div><a className="url" href={url}>{url}</a></div>
  }
}

export class LoginComponent extends React.Component<{
  store: AppStore;
}, {
  password: string;
}> {
  check: Promise<boolean>
  constructor() {
    super();
    this.state = {
      password: localStorage["password"] || ""
    };

  }
  componentWillMount() {
  }
  onInputChange(e: any) {
    this.setState({
      password: e.target.value
    } as any);
    this.check = this.props.store.login(e.target.value);
    this.check.then(
      (result) => { this.forceUpdate(); },
      () => { this.forceUpdate(); }
    );
  }
  getValidationState(): "success" | "warning" | "error" {
    let password = this.state.password;
    if (password.length === 0) {
      return "error";
    }
    return this.props.store.isLoggedIn ? "success" : "error";
  }
  render() {
    return <Form>
      <FormGroup validationState={this.getValidationState()}>
        <ControlLabel>AWCY API Key</ControlLabel>
        <FormControl type="text" placeholder=""
          value={this.state.password} onChange={this.onInputChange.bind(this)} />
        <FormControl.Feedback/>
      </FormGroup>
    </Form>
  }
}