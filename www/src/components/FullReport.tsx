import * as React from "react";
import { Tabs, Tab, Table, ListGroup, ListGroupItem } from "react-bootstrap";
import { Jumbotron, Grid, Popover, OverlayTrigger, Navbar, Checkbox, Form, FormGroup, ControlLabel, FormControl, HelpBlock, Modal, Panel, Label, Col, Row, Button, ProgressBar, Badge, ButtonToolbar, DropdownButton, MenuItem } from "react-bootstrap";

import { BDRatePlot, sortArray, ScatterPlotSeries, PlotAxis } from "./Plot";
import { VideoReportComponent, BDRateReportComponent } from "./Report";
import { JobSelectorComponent } from "./JobSelector";
import { Promise } from "es6-promise";
import { AnalyzerVideoSelectorComponent } from "./Widgets";

import { JobComponent } from "./Job";
import { JobLogComponent } from "./JobLog";

import { getRandomColorForString, appStore, shallowEquals, Jobs, Job, JobStatus, loadXHR, ReportField, reportFieldNames, metricNames, metricNameToReportFieldIndex } from "../stores/Stores";
declare var google: any;
declare var tinycolor: any;
declare var require: any;
let Select = require('react-select');


export class FullReportComponent extends React.Component<void, {
    metric: string,
    video: string,
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
      metric: "MS SSIM",
      video: "Total"
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
    let fit = this.state.fit;
    let log = this.state.log;
    function addSeries(job, name, seriesName, color) {
      let values = [];
      job.report[name].forEach(row => {
        let bitRate = (row[ReportField.Size] * 8) / row[ReportField.Pixels];
        let quality = row[reportFieldIndex];
        values.push([bitRate, quality]);
      });
      sortArray(values, 0);
      series.push({
        name: seriesName,
        values: values,
        color: color(job, name),
        xAxis: {
          min: fit ? undefined : 0.001,
          max: fit ? undefined : 1,
          log: log
        },
        yAxis: {
          min: fit ? undefined : 0,
          max: fit ? undefined : 50
        }
      });
    }
    jobs.forEach(job => {
      if (name == "All") {
        for (let name in job.report) {
          addSeries(job, name, job.selectedName + " " + name, (job, name) => getRandomColorForString(name));
        }
      } else {
        addSeries(job, name, job.selectedName, (job, name) => job.color);
      }
    });
    return series;
  }
  onJobSelectorChange(metric: string, video: string) {
    this.setState({ metric, video } as any);
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
  renderVideoReport(video: string, metric: string, showTabs = true) {
    let jobs = appStore.jobs.getSelectedJobs();
    let headers = <th key={this.state.metric} className="tableHeader">{metric}</th>
    let rows, cols;
    let plotHeight = 500;
    let yFormat = metric == "Encoding Time" ? "d" : ".2";
    rows = [
      <td style={{ padding: 0, width: "100%" }}>
        <BDRatePlot width={"100%"} height={plotHeight} series={this.getSeries(video, metric)} yFormat={yFormat} />
      </td>
    ];
    let tabs = null;
    if (showTabs) {
      tabs = <Tabs animation={false} id="noanim-tab-example">
        {jobs.map((job, i) => {
          return <Tab eventKey={i} key={job.id} title={job.selectedName}>
            <div style={{paddingTop: 10}}>
              <VideoReportComponent name={video} job={job} highlightColumns={[metric]} filterQualities={[]} />
            </div>
          </Tab>
        })}
      </Tabs>
    }

    return <div key={video}>
      <Panel className="videoReport" header={video}>
        <Table condensed bordered={false} style={{width: "100%"}}>
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
    let metrics = [this.state.metric];
    return <div>
      <Panel>
        {selectedJobs}
      </Panel>
      <Panel>
        <JobSelectorComponent metric={this.state.metric} video={this.state.video} jobs={jobs} onChange={this.onJobSelectorChange.bind(this)} />
      </Panel>
      <div style={{ }}>
        <Button active={this.state.fit} onClick={this.onFitClick.bind(this)}>Fit Charts</Button>{' '}
        <Button active={this.state.log} onClick={this.onLogClick.bind(this)}>Logarithmic</Button>{' '}
      </div>
      <div style={{ paddingTop: 8 }}>
        {this.renderVideoReport(this.state.video, this.state.metric)}
        <BDRateReportComponent a={jobs[0]} b={jobs[1]}/>
      </div>
    </div>;
  }
}
