import * as React from "react";
import { Button, Panel, Form, FormGroup, ControlLabel, FormControl, ButtonToolbar } from "react-bootstrap";
import { } from "react-bootstrap";
import { appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile } from "../stores/Stores";
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

export class ShareComponent extends React.Component<{}, void> {
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

export class LoginComponent extends React.Component<{}, {
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
