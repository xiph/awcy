import * as React from "react";
import { Tabs, Tab, Table, ListGroup, ListGroupItem } from "react-bootstrap";
import { Jumbotron, Grid, Popover, OverlayTrigger, Navbar, Checkbox, Form, FormGroup, ControlLabel, FormControl, HelpBlock, Modal, Panel, Label, Col, Row, Button, ProgressBar, Badge, ButtonToolbar, DropdownButton, MenuItem } from "react-bootstrap";

import { BDRatePlot, sortArray, ScatterPlotSeries, PlotAxis } from "./Plot";
import { VideoReportComponent, BDRateReportComponent } from "./Report";
import { JobSelectorComponent } from "./Widgets";
import { Promise } from "es6-promise";
import { AnalyzerVideoSelectorComponent, AnalyzerComponent } from "./Widgets";

import { JobListItemComponent } from "./Jobs";
import { JobLogComponent } from "./Log";

import { AppStore, Jobs, Job, JobStatus, loadXHR, ReportField, reportFieldNames, metricNames, metricNameToReportFieldIndex } from "../stores/Stores";
declare var google: any;
declare var tinycolor: any;
declare var require: any;
let Select = require('react-select');

export class FullReportComponent extends React.Component<{
  jobs: Jobs;
}, {
    metrics: string[],
    videos: string[],
    qualities: number[],
    fit: boolean;
    log: boolean;
    stack: boolean;
    jobsToCompare: Job[];
  }> {
  constructor() {
    super();
    this.state = {
      fit: true,
      log: true,
      stack: false,
      jobsToCompare: [],
      metrics: ["MSSSIM"],
      videos: [],
      qualities: []
    };
  }
  componentWillMount() {
    this.props.jobs.onChange.attach(name => {
      this.load();
    });
    this.load();
  }
  load() {
    Promise.all(this.props.jobs.jobs.map(job => {
      return job.loadReport();
    })).then(data => {
      this.setState({ jobsToCompare: this.props.jobs.jobs } as any);
    });
  }
  getSeries(name: string, metric: string): ScatterPlotSeries[] {
    let series = [];
    let jobs = this.props.jobs.jobs;
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
  renderVideoReport(video: string, stack: boolean) {
    let jobs = this.props.jobs.jobs;
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
    let tabs = jobs.map((job, i) => {
      return <Tab eventKey={i} key={job.id} title={job.selectedName}>
        <div style={{paddingTop: 10}}>
          <VideoReportComponent name={video} job={job} highlightColumns={metrics} filterQualities={qualities} />
        </div>
      </Tab>
    });
    return <div key={video}>
      <Panel header={video}>
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
        <Tabs animation={false} id="noanim-tab-example">
          {tabs}
        </Tabs>
        <AnalyzerVideoSelectorComponent video={video} jobs={jobs}/>
      </Panel>
    </div>
  }
  render() {
    console.debug("Rendering Full Report");
    let jobs = this.props.jobs.jobs;
    if (jobs.length == 0) {
      return <div>
        <p>No runs selected.</p>
      </div>
    }

    let failedJobInfos = [];
    jobs.forEach(job => {
      if (!job.completed) {
        failedJobInfos.push(<Panel key={job.id}>
          <JobListItemComponent store={null} detailed job={job}/>
          <JobLogComponent job={job} />
        </Panel>);
      }
    });

    let tables = [];
    let job = jobs[0];
    let otherJob = jobs[1];
    let metrics = this.state.metrics;
    let qualities = this.state.qualities;
    let jobsToCompare = this.state.jobsToCompare;
    for (let video in job.report) {
      if (this.state.videos.length && this.state.videos.indexOf(video) < 0) {
        continue;
      }
      if (video === "Total") {
        continue;
      }
      tables.push(this.renderVideoReport(video, this.state.stack));
    }
    let report = <BDRateReportComponent a={jobsToCompare[0]} b={jobsToCompare[1]}/>
    return <div style={{ width: "980px" }}>
      <div>
        <JobSelectorComponent metrics={this.state.metrics} jobs={this.props.jobs.jobs} onChange={this.onJobSelectorChange.bind(this)} />
      </div>
      <div style={{ paddingBottom: 8, paddingTop: 4 }}>
        <Button active={this.state.fit} onClick={this.onFitClick.bind(this)}>Fit Charts</Button>{' '}
        <Button active={this.state.log} onClick={this.onLogClick.bind(this)}>Logarithmic</Button>{' '}
        <Button active={this.state.stack} onClick={this.onStackClick.bind(this)}>Enlarge Charts</Button>
      </div>
      <div style={{ paddingTop: 8 }}>
        {this.renderVideoReport("Total", this.state.stack)}
        {report}
        {tables}
      </div>
    </div>;
  }
}