import * as React from "react";
import { Tabs, Tab, Table, ListGroup, ListGroupItem } from "react-bootstrap";
import { Jumbotron, Grid, Popover, OverlayTrigger, Navbar, Checkbox, Form, FormGroup, ControlLabel, FormControl, HelpBlock, Modal, Panel, Label, Col, Row, Button, ProgressBar, Badge, ButtonToolbar, DropdownButton, MenuItem } from "react-bootstrap";

import { BDRatePlot, sortArray, ScatterPlotSeries, PlotAxis } from "./Plot";
import { VideoReportComponent, BDRateReportComponent } from "./Report";
import { JobSelectorComponent } from "./Widgets";
import { Promise } from "es6-promise";
import { AnalyzerVideoSelectorComponent, AnalyzerComponent } from "./Widgets";

import { JobComponent } from "./Job";
import { JobLogComponent } from "./JobLog";

import { appStore, shallowEquals, Jobs, Job, JobStatus, loadXHR, ReportField, reportFieldNames, metricNames, metricNameToReportFieldIndex } from "../stores/Stores";
declare var google: any;
declare var tinycolor: any;
declare var require: any;
let Select = require('react-select');


export class FullReportComponent extends React.Component<void, {
    metrics: string[],
    videos: string[],
    qualities: number[],
    fit: boolean;
    log: boolean;
    stack: boolean;
  }> {
  onChange: any;
  constructor() {
    super();
    this.state = {
      fit: true,
      log: true,
      stack: false,
      metrics: ["MSSSIM"],
      videos: [],
      qualities: []
    };
    this.onChange = () => {
      this.load();
    };
  }
  componentWillMount() {
    appStore.jobs.onChange.attach(this.onChange);
    this.load();
  }
  componentWillUnmount() {
    appStore.jobs.onChange.detach(this.onChange);
  }
  load() {
    let jobs = appStore.jobs.getSelectedJobs();
    Promise.all(jobs.map(job => {
      return job.loadReport();
    })).catch(() => {
      this.forceUpdate();
    }).then(data => {
      this.forceUpdate();
    });
  }
  getSeries(name: string, metric: string): ScatterPlotSeries[] {
    let series = [];
    let jobs = appStore.jobs.getSelectedJobs();
    let reportFieldIndex = metricNameToReportFieldIndex(metric);
    jobs.forEach(job => {
      let values = [];
      job.report[name].forEach(row => {
        let bitRate = (row[ReportField.Size] * 8) / row[ReportField.Pixels];
        let quality = row[reportFieldIndex];
        values.push([bitRate, quality]);
      })
      sortArray(values, 0);
      series.push({
        name: job.selectedName,
        values: values,
        color: job.color,
        xAxis: {
          min: this.state.fit ? undefined : 0.001,
          max: this.state.fit ? undefined : 1,
          log: this.state.log
        },
        yAxis: {
          min: this.state.fit ? undefined : 0,
          max: this.state.fit ? undefined : 50
        }
      });
    });
    return series;
  }
  onJobSelectorChange(metrics: string[], videos: string[], qualities: number[]) {
    this.setState({ metrics, videos, qualities } as any);
  }
  onFitClick() {
    this.setState({ fit: !this.state.fit } as any);
  }
  onLogClick() {
    this.setState({ log: !this.state.log } as any);
  }
  onStackClick() {
    this.setState({ stack: !this.state.stack } as any);
  }
  renderVideoReport(video: string, stack: boolean, showTabs = true) {
    let jobs = appStore.jobs.getSelectedJobs();
    let metrics = this.state.metrics;
    let qualities = this.state.qualities;
    let headers = metrics.map(name =>
      <th key={name} className="tableHeader">{name}</th>
    );
    let rows, cols;
    if (!stack) {
      let plotWidth = (940 / metrics.length) | 0;
      let plotHeight = 200;
      cols = metrics.map(metric =>
        <td key={metric} style={{ padding: 0 }}>
          <BDRatePlot width={plotWidth} height={plotHeight} series={this.getSeries(video, metric)} />
        </td>
      );
      rows = [<tr key={video}>{cols}</tr>];
    } else {
      let plotWidth = 940;
      let plotHeight = 400;
      headers = [<th key={name} className="tableHeader"></th>];
      rows = [];
      metrics.forEach(metric => {
        rows.push(<tr key={metric + "-Header"}><td className="tableHeader">{metric}</td></tr>);
        rows.push(<tr key={metric}>
          <td style={{ padding: 0 }}>
            <BDRatePlot width={plotWidth} height={plotHeight} series={this.getSeries(video, metric)} />
          </td>
        </tr>);
      });
    }
    let tabs = null;
    if (showTabs) {
      tabs = <Tabs animation={false} id="noanim-tab-example">
        {jobs.map((job, i) => {
          return <Tab eventKey={i} key={job.id} title={job.selectedName}>
            <div style={{paddingTop: 10}}>
              <VideoReportComponent name={video} job={job} highlightColumns={metrics} filterQualities={qualities} />
            </div>
          </Tab>
        })}
      </Tabs>
    }

    return <div key={video}>
      <Panel className="videoReport" header={video}>
        <Table condensed bordered={false}>
          <thead>
            <tr>
              {headers}
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </Table>
        {tabs}
      </Panel>
    </div>
    // <AnalyzerVideoSelectorComponent video={video} jobs={jobs}/>
  }
  render() {
    console.debug("Rendering Full Report");
    let jobs = appStore.jobs.getSelectedJobs();
    if (jobs.length == 0) {
      return <Panel>
        No runs selected.
      </Panel>
    }

    let selectedJobs = [];
    jobs.forEach(job => {
      selectedJobs.push(<JobComponent key={job.id} job={job}/>);
    });

    let tables = [];
    let brokenJobs = jobs.filter(job => !job.report);
    if (brokenJobs.length) {
      let logs = [];
      jobs.forEach(job => {
        logs.push(<div key={job.id}>
          <JobComponent detailed job={job}/>
          <JobLogComponent job={job} />
        </div>);
      });
      return <Panel>
        {logs}
        Jobs [{brokenJobs.map(job => job.id).join(", ")}] don't have valid reports.
      </Panel>
    }

    let job = jobs[0];
    let metrics = this.state.metrics;
    let qualities = this.state.qualities;
    for (let video in job.report) {
      if (this.state.videos.length && this.state.videos.indexOf(video) < 0) {
        continue;
      }
      if (video === "Total") {
        continue;
      }
      tables.push(this.renderVideoReport(video, this.state.stack));
    }
    let report = <BDRateReportComponent a={jobs[0]} b={jobs[1]}/>
    return <div style={{ width: "980px" }}>
      <Panel>
        {selectedJobs}
      </Panel>
      <Panel>
        <JobSelectorComponent metrics={this.state.metrics} jobs={jobs} onChange={this.onJobSelectorChange.bind(this)} />
      </Panel>
      <div style={{ }}>
        <Button active={this.state.fit} onClick={this.onFitClick.bind(this)}>Fit Charts</Button>{' '}
        <Button active={this.state.log} onClick={this.onLogClick.bind(this)}>Logarithmic</Button>{' '}
        <Button active={this.state.stack} onClick={this.onStackClick.bind(this)}>Enlarge Charts</Button>
      </div>
      <div style={{ paddingTop: 8 }}>
        {this.renderVideoReport("Total", this.state.stack, false)}
        {report}
        {tables}
      </div>
    </div>;
  }
}