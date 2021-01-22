import * as React from "react";
import { Glyphicon, Panel, Table } from "react-bootstrap";
import { Button, FormGroup, } from "react-bootstrap";
import { Option } from "./Widgets";
import { BDRateReport, Report, AppStore, Job, reportFieldNames, analyzerBaseUrl} from "../stores/Stores";

declare var require: any;

let Select = require('react-select');

function formatNumber(n) {
  return n.toLocaleString(); // .replace(/\.00$/, '');
}
function makeTableCell(key: any, v: number, color: boolean = false, formatter = formatNumber) {
  let className = "tableValue";
  if (color) {
    if (Math.abs(v) < 0.005) {
      className = "zeroTableValue";
    } else if (v > 0) {
      className = "positiveTableValue";
    } else if (v < 0) {
      className = "negativeTableValue";
    }
  }
  return <td key={key} className={className}>{formatter(v)}</td>
}

function defaultQualities(codec: string) {
  if (codec == "rav1e") {
    return "80 128 172 220 252";
  } else {
    return "20 32 43 55 63";
  }
}

interface VideoReportProps {
  name?: string;
  job: Job;
  highlightColumns?: string [];
  filterQualities?: number [];
}

let displayedBDRateMetrics = ['PSNR Y (libvmaf)', 'PSNR Cb (libvmaf)', 'PSNR Cr (libvmaf)', 'CIEDE2000 (libvmaf)', 'SSIM (libvmaf)', 'MS-SSIM (libvmaf)', 'PSNR-HVS Y (libvmaf)', 'PSNR-HVS Cb (libvmaf)', 'PSNR-HVS Cr (libvmaf)', 'VMAF', 'VMAF-NEG'];

// this is the chart of raw metric scores underneath the graph

export class VideoReportComponent extends React.Component<VideoReportProps, {
  jobReport: Report;
}> {
  constructor() {
    super();
    this.state = {jobReport: null};
  }
  componentDidReceiveProps(nextProps: VideoReportProps, _nextContext: any) {
    if (this.props.job !== nextProps.job) {
      this.loadReport("jobReport", nextProps.job);
    }
  }
  loadReport(name: string, job: Job) {
    if (job) {
      job.loadReport().then((report) => {
        this.setState({jobReport: report} as any);
      });
    } else {
      this.setState({jobReport: null} as any);
    }
  }
  componentDidMount() {
    this.loadReport("jobReport", this.props.job);
  }
  render() {
    // console.debug("Rendering Video Report");
    let highlightColumns = this.props.highlightColumns;
    function tableHeaderClassName(name) {
      if (highlightColumns && highlightColumns.indexOf(name) >= 0) {
        return "highlightedTableHeader";
      }
      return "tableHeader";
    }
    let headers = reportFieldNames.map(name =>
      <th key={name} className={tableHeaderClassName(name)}>{name}</th>
    );

    let hasIvfs = this.props.name !== "Total";
    if (hasIvfs) {
      headers.unshift(<th className="tableToolHeader" key={"link-0"}></th>);
      headers.unshift(<th className="tableToolHeader" key={"link-1"}></th>);
    }

    let rows = [];
    let name = this.props.name;
    let jobVideoReport = this.state.jobReport ? this.state.jobReport[name] : null;
    if (!jobVideoReport) {
      return null;
    }
    jobVideoReport.forEach(row => {
      if (this.props.filterQualities.length &&
          this.props.filterQualities.indexOf(row[0]) < 0) {
        return;
      }
      let cols = row.map((v, i) => {
        return <td key={i} className="tableValue">{formatNumber(v)}</td>
      });
      let quality = row[0];
      if (hasIvfs) {
        let ivfUrl = this.props.job.ivfUrl(this.props.name, quality);
        cols.unshift(<td key="link-0" className="tableValue"><a href={ivfUrl} alt="Download"><Glyphicon glyph="download-alt" /></a></td>);
        let analyzerUrl = this.props.job.analyzerIvfUrl(this.props.name, quality);
        cols.unshift(<td key="link-1" className="tableValue"><a target="_blank" href={analyzerUrl} alt="Analyze"><Glyphicon glyph="film" /></a></td>);
      }
      rows.push(<tr key={quality}>{cols}</tr>);
    });
    let reportUrl = hasIvfs ? this.props.job.reportUrl(this.props.name) : this.props.job.totalReportUrl();
    let table = <div style={{overflowY: "scroll"}}>
      <Table striped bordered condensed hover style={{width: "100%"}}>
        <thead>
          <tr>
            {headers}
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </Table>
      <h5>Raw Data:</h5><a href={reportUrl}>{reportUrl}</a>
    </div>
    return table;
  }
}

export class AnalyzerLinksComponent extends React.Component<{
  jobs: Job []
}, {
  mode: string;
  maxFrames: string;
}> {
  modeOptions: Option[];
  maxFramesOptions: Option[];
  constructor() {
    super();
    this.state = {
      maxFrames: "4",
      mode: ""
    } as any;
    this.maxFramesOptions = [
      { value:  "1", label: "1" },
      { value:  "2", label: "2" },
      { value:  "4", label: "4" },
      { value:  "8", label: "8" },
      { value: "16", label: "16" },
      { value: "32", label: "32" },
      { value: "64", label: "64" },
      { value: "124", label: "124" }
    ];
    this.modeOptions = [
      { value:  "", label: "Default" },
      { value:  "reference", label: "Compare w/ Reference" },
      { value:  "blind", label: "Blind Mode" },
      { value:  "split", label: "Split Mode" }
    ];
  }
  onMaxFramesChange(option) {
    this.setState({maxFrames: option.value} as any);
  }
  onModeChange(option) {
    this.setState({mode: option.value} as any);
  }
  render() {
    let jobs = this.props.jobs;
    let mode = this.state.mode;
    let maxFrames = this.state.maxFrames;
    let qualities = (jobs[0].qualities || defaultQualities(jobs[0].codec)).split(" ").map(x => parseInt(x));
    let report = this.props.jobs[0].report;
    let videoRows = [];
    let videos = [];

    for (let video in report) {
      if (video != "Total") {
        videos.push(video);
      }
    }

    function makePair(job: Job, video: string, quality: number): string {
      return `decoder=${job.decoderUrl()}&decoderName=${encodeURIComponent(job.id)}&file=${job.ivfUrl(video, quality)}`;
    }

    function makeUrl(jobs: Job [], video: string, quality: number): string {
      let blindOption = mode == "blind" ? "blind=1&" : "";
      let splitOption = mode == "split" ? "split=4&" : "";
      let url = analyzerBaseUrl + `?${blindOption}${splitOption}maxFrames=${maxFrames}&`;
      if (mode == "reference") {
        url += makePair(jobs[0], video, qualities[0]) + "&";
      }
      url += jobs.map(job => makePair(job, video, quality)).join("&");
      return url;
    }

    videos.forEach(video => {
      let links = qualities.map(q => {
        let url = makeUrl(jobs, video, q);
        return <span><a key={q} target="_blank" href={url} alt="Analyze">{q}</a> </span>
      });
      videoRows.push(<tr key={video}><td>{video}</td><td>{links}</td></tr>);
    });
    return <Panel header="Analyzer Links">
      <div style={{width: "256px"}} >
        <div className="selectTitle">Max Frames</div>
        <Select autofocus value={this.state.maxFrames} options={this.maxFramesOptions} onChange={this.onMaxFramesChange.bind(this)} clearable={false}/>
        <div className="selectTitle" style={{marginTop: "8px"}}>Mode</div>
        <Select autofocus value={this.state.mode} options={this.modeOptions} onChange={this.onModeChange.bind(this)} clearable={false}/>
      </div>
      <table id="analyzerLinksTable">
        <col/><col/>
        {
          jobs.map(job => <col key={job.id}/>)
        }
        <thead>
          <tr>
            <td>Video</td>
            <td>{jobs.map(job => job.selectedName).join(" vs. ")}</td>
          </tr>
        </thead>
        <tbody>
          {videoRows}
        </tbody>
      </table>
    </Panel>
  }
}

interface BDRateReportProps {
  a: Job,
  b: Job,
}

export class BDRateReportComponent extends React.Component<BDRateReportProps, {
  report: BDRateReport;
  textReport: string;
  reversed: boolean;
  range: Option;
  interpolation: Option;
}> {
  constructor() {
    super();
    this.state = { report: null, textReport: null, reversed: false, range: "fullrange", interpolation:"pchip-new"} as any;
  }
  componentDidUpdate(prevProps: BDRateReportProps) {
    if (this.props.a !== prevProps.a || this.props.b !== prevProps.b) {
      this.loadReport(this.props, this.state.range.value, this.state.interpolation.value);
    }
  }
  loadReport(props: BDRateReportProps, range: string, interpolation: string) {
    console.log("loadReport");
    let a = props.a;
    let b = props.b;
    if (!a || !b) {
      return;
    }
    this.setState({report: null, textReport: null} as any);
    AppStore.loadBDRateReport(a, b, a.task, "report-overlap", range, interpolation).then((report) => {
      this.setState({report} as any);
    });
  }
  componentDidMount() {
    this.loadReport(this.props, this.state.range.value, this.state.interpolation.value);
  }
  onReverseClick() {
    let report = this.state.report;
    this.setState({reversed: !this.state.reversed} as any);
    this.loadReport({a: report.b, b: report.a}, this.state.range.value, this.state.interpolation.value);
  }
  onChangeRange(range: Option) {
    let report = this.state.report;
    this.setState({ range } as any);
    this.loadReport({a: report.a, b: report.b}, range.value, this.state.interpolation.value);
  }
  onChangeInterpolation(interpolation: Option) {
    let report = this.state.report;
    this.setState({ interpolation } as any);
    this.loadReport({a: report.a, b: report.b}, this.state.range.value, interpolation.value);
  }

  onTextReportClick() {
    function padTable(rows: any [][]) {
      let numCols = rows[0].length;
      let maxColWidths = new Uint32Array(numCols);
      for (let i = 0; i < numCols; i++) {
        for (let j = 0; j < rows.length; j++) {
          maxColWidths[i] = Math.max(maxColWidths[i], rows[j][i].length);
        }
      }
      function padLeft(s, l, c) {
        while (s.length < l)
          s = c + s;
        return s;
      }
      for (let i = 0; i < numCols; i++) {
        for (let j = 0; j < rows.length; j++) {
          rows[j][i] = padLeft(rows[j][i], maxColWidths[i], ' ');
        }
      }
    }

    let report = this.state.report;
    let summaryHeaders = ["PSNR Y (libvmaf)", "PSNR Cb (libvmaf)", "PSNR Cr (libvmaf)", "CIEDE2000 (libvmaf)", "SSIM (libvmaf)", "MS-SSIM (libvmaf)", "PSNR-HVS Y (libvmaf)", "PSNR-HVS Cb (libvmaf)", "PSNR-HVS Cr (libvmaf)", "PSNR-HVS (libvmaf)", "VMAF", "VMAF-NEG"];
    let summaryRows = [summaryHeaders.map(title => title.replace(" (libvmaf)",""))];
    summaryRows.push(summaryHeaders.map(name =>
      report.average[name] != undefined ? report.average[name].toFixed(4) : "N/A"
    ));
    padTable(summaryRows);

    let text = report.a.id + " -> " + report.b.id + "\n\n";
    text += summaryRows.map(row => row.join(" | ")).join("\n");

    function toRow(video: string, data) {
      return [video].concat(displayedBDRateMetrics.map(name => {
        if (name in data) {
          return data[name] != undefined ? data[name].toFixed(4) : "N/A";
        } else {
          return "N/A";
        }
      }));
    }
    let rowHeaders = ["Video"].concat(displayedBDRateMetrics);
    let rows = [rowHeaders];
    for (let video in report.metrics) {
      rows.push(toRow(video, report.metrics[video]));
    }
    padTable(rows);
    text += "\n\n";
    text += rows.map(row => row.join(" | ")).join("\n");

    // Markdown
    text += "\n\nMarkdown Version\n\n";
    summaryRows.splice(1, 0, summaryHeaders.map(() => "---:"));
    padTable(summaryRows);
    text += summaryRows.map(row => `| ${row.join(" | ")} |`).join("\n");

    text += "\n\n";
    rows.splice(1, 0, rowHeaders.map(() => "---:"));
    padTable(rows);
    text += rows.map(row => `| ${row.join(" | ")} |`).join("\n");
    this.setState({textReport: text} as any);
  }
  render() {
    console.debug("Rendering BDRateReport");
    let a = this.props.a;
    let b = this.props.b;
    let report = this.state.report;
    if (a && b) {
      if (!report) {
        return <Panel header={"BD Rate Report"}>
            <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Loading report ...
        </Panel>
      }
    } else {
      return <Panel header={"BD Rate Report"}>
          Select two jobs.
      </Panel>
    }
    let headers = [<th key="video" className="tableHeader">Video</th>];
    headers = headers.concat(displayedBDRateMetrics.map(name => <th key={name} className="tableHeader">{name}</th>));

    let rows = [];
    function toRow(video: string, data, big = false) {
      let cols = [<td key={"fileName"} className="longTableValue">{video}</td>];
      cols = cols.concat(displayedBDRateMetrics.map(name =>
        makeTableCell(name, data[name], true, (n) => {
          return typeof n === "number" ? n.toFixed(2) : n;
        })
      ));
      return <tr key={video} className={big ? "bigRow" : ""}>{cols}</tr>
    }
    rows.push(toRow("Average", report.average, true));
    for (let category in report.categories) {
      rows.push(toRow(category, report.categories[category],true));
    }
    for (let video in report.metrics) {
      rows.push(toRow(video, report.metrics[video]));
    }
    let errors = [];
    for (let error of report.error_strings) {
      errors.push(<p className="bg-warning">{error}</p>);
    }
    let rangeOptions: Option[] = [];
    rangeOptions.push({ value: "fullrange", label: "Quantizer range: All" });
    rangeOptions.push({ value: "av1", label: "Quantizer range: 20-55" });
    let interpolationOptions: Option[] = [];
    interpolationOptions.push({ value: "pchip-new", label: "New interpolation method" });
    interpolationOptions.push({ value: "pchip-old", label: "Historic (AV1) interpolation method" });
    let textReport = this.state.textReport ? <pre>{this.state.textReport}</pre> : null;
      return <Panel header={`BD Rate Report ${report.a.selectedName + " " + report.a.id} → ${report.b.selectedName + " " + report.b.id}`}>
        <div style={{ paddingBottom: 8, paddingTop: 4 }}>
          <Button active={this.state.reversed} onClick={this.onReverseClick.bind(this)} >Reverse</Button>{' '}
          <Button onClick={this.onTextReportClick.bind(this)} >Get Text Report</Button>
          <FormGroup>
            <Select clearable={false} value={this.state.range} onChange={this.onChangeRange.bind(this)} options={rangeOptions} placeholder="Range">
            </Select>
            <Select clearable={false} value={this.state.interpolation} onChange={this.onChangeInterpolation.bind(this)} options={interpolationOptions} placeholder="interpolation">
            </Select>
          </FormGroup>
        </div>
        {errors}
        {textReport}
        <div style={{overflowY: "scroll"}}>
          <Table striped bordered condensed hover style={{width: "100%"}}>
            <thead>
              <tr>
                {headers}
              </tr>
            </thead>
            <tbody>
              {rows}
            </tbody>
          </Table>
        </div>
      </Panel>
  }
}
