import * as React from "react";
import { Glyphicon, Panel, Table } from "react-bootstrap";
import { Button, FormGroup, } from "react-bootstrap";
import { Option } from "./Widgets";
import { BDRateReport, Report, AppStore, Job, reportFieldNames, outFileFieldNames, analyzerBaseUrl, baseUrl,loadXHR2 } from "../stores/Stores";

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

let displayedBDRateMetrics = ['Encoding Time', 'Decoding Time', 'PSNR Y (libvmaf)', 'PSNR Cb (libvmaf)', 'PSNR Cr (libvmaf)', 'CIEDE2000 (libvmaf)', 'SSIM (libvmaf)', 'MS-SSIM (libvmaf)', 'PSNR-HVS Y (libvmaf)', 'PSNR-HVS Cb (libvmaf)', 'PSNR-HVS Cr (libvmaf)', 'PSNR-HVS (libvmaf)', 'VMAF', 'VMAF-NEG'];

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
      headers.unshift(<th className="tableToolHeader" key={"link-stdout"}></th>); // stdout
      headers.unshift(<th className="tableToolHeader" key={"link-stderr"}></th>); // stderr
      headers.unshift(<th className="tableToolHeader" key={"link-0"}></th>);
      headers.unshift(<th className="tableToolHeader" key={"link-1"}></th>);
      headers.unshift(<th className="tableToolHeader" key={"link-2"}>XML</th>);
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
      let cols = reportFieldNames.map((v, i) => {
        let field_index = outFileFieldNames.indexOf(v);
        if (field_index in row) {
          return <td key={i} className="tableValue">{formatNumber(row[field_index])}</td>
        } else {
          return <td key={i} className="tableValue">N/A</td>
        }
      });
      let quality = row[0];
      if (hasIvfs) {
        let stdoutUrl = this.props.job.stdoutUrl(this.props.name, quality);
        cols.unshift(<td key="link-stdout" className="tableValueCentered"><a href={stdoutUrl}>stdout</a></td>);
        let stderrUrl = this.props.job.stderrUrl(this.props.name, quality);
        cols.unshift(<td key="link-stderr" className="tableValueCentered"><a href={stderrUrl}>stderr</a></td>);
        let ivfUrl = this.props.job.ivfUrl(this.props.name, quality);
        cols.unshift(<td key="link-0" className="tableValue"><a href={ivfUrl} alt="Download"><Glyphicon glyph="download-alt" /></a></td>);
        let analyzerUrl = this.props.job.analyzerIvfUrl(this.props.name, quality);
        cols.unshift(<td key="link-1" className="tableValue"><a target="_blank" href={analyzerUrl} alt="Analyze"><Glyphicon glyph="film" /></a></td>);
        let libvmafXmlUrl = this.props.job.libvmafXmlUrl(this.props.name, quality);
        cols.unshift(<td key="link-2" className="tableValueCentered"><a href={libvmafXmlUrl} alt="XML"><Glyphicon glyph="eye-open" /></a></td>);
      }
      rows.push(<tr key={quality}>{cols}</tr>);
    });
    let reportUrl = hasIvfs ? this.props.job.reportUrl(this.props.name) : this.props.job.totalReportUrl();
    let csvExportUrl = `csv_export.csv?a=${encodeURIComponent(this.props.job.id)}`;
    let jobDownloaderUrl = `download_run.zip?a=${encodeURIComponent(this.props.job.id)}`;
    let table = <div style={{overflowX: "scroll"}}>
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
      <br/>
      <Button href={csvExportUrl}>CTC CSV Export</Button>
      <Button href={jobDownloaderUrl}>Download Job (zip)</Button>
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
    let method = 'report-overlap';
    if (a.codec == 'av2-as' || a.codec == 'av2-as-st') {
      method = 'report-as';
    }
    AppStore.loadBDRateReport(a, b, a.task, method, range, interpolation).then((report) => {
      this.setState({report} as any);
    });
  }
  componentDidMount() {
    this.loadReport(this.props, this.state.range.value, this.state.interpolation.value);
    this.startPollingCtcLog();
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

  logInterval: any;
  ctc_xls_logs: any;

  // Read the CTC XLSM generation stdout every 5 seconds
  startPollingCtcLog() {
    if (this.logInterval) {
      clearInterval(this.logInterval);
    }
    this.logInterval = setInterval(() => {
      this.loadCtcLog(true);
    }, 2500);
  }

  loadCtcLog(refresh = false): Promise<string> {
    if (this.props.a && this.props.b) {
      let codec_a = this.props.a.codec;
      let codec_b = this.props.b.codec;
      let ctcVersion_a = this.props.a.ctcVersion;
      let ctcVersion_b = this.props.b.ctcVersion;
      let ctcVersion_target = "5.0";
      let ctc_as_flag = false;
      if ((codec_a == 'av2-as' || codec_a == 'av2-as-st' || codec_a == 'vvc-vtm-as-ctc') && (codec_b == 'av2-as' || codec_b == 'av2-as-st' || codec_b == 'vvc-vtm-as-ctc')) {
        ctc_as_flag = true;
      }
      if (this.ctc_xls_logs && !refresh) {
        return Promise.resolve(this.ctc_xls_logs);
      }
      let ctc_xlsm = 'AOM_CWG_Regular_CTCv4_v7.3.2-';
      if (ctc_as_flag == true)
        ctc_xlsm = 'AOM_CWG_AS_CTC_v9.7-';
      if (ctcVersion_a == ctcVersion_target || ctcVersion_b == ctcVersion_target) {
        ctc_xlsm = 'AOM_CWG_Regular_CTCv5_v7.4.5-';
        if (ctc_as_flag == true)
          ctc_xlsm = 'AOM_CWG_AS_CTC_v9.9-';
      }
      let filename_to_send = ctc_xlsm + this.props.a.id + '-' + this.props.b.id + '.txt';
      let path = baseUrl + 'runs/ctc_results/' + filename_to_send;
      return loadXHR2<string>(path, "text").then((log) => {
        this.ctc_xls_logs = log;
      }).catch(() => {
        this.ctc_xls_logs = "";
      }) as any;
    }
  }

  render() {
    console.debug("Rendering BDRateReport");
    let a = this.props.a;
    let b = this.props.b;
    let report = this.state.report;
    if (a && b) {
      if (!report) {
        let args = [
          "a=" + encodeURIComponent(a.id),
          "b=" + encodeURIComponent(b.id),
          "codec_a="+ encodeURIComponent(a.codec),
          "codec_b="+ encodeURIComponent(b.codec),
          "ctcVersion_a="+ encodeURIComponent(a.ctcVersion),
          "ctcVersion_b="+ encodeURIComponent(b.ctcVersion)
          ];
        let csvExportUrl = baseUrl + "ctc_report.xlsm?" + args.join("&");
        return <Panel header={"BD Rate Report"}>
          <Button href={csvExportUrl}>Get Partial CTC Report</Button>{' '}
          <br></br>
          <span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Full Report loading ...
          <details style={{
            position: 'relative',
            top: 4,
            fontFamily: "'Roboto Mono',monospace",
            fontSize: 12,
          }} open>
            <summary className="Select-control" style={{
              paddingBottom: 8,
              paddingTop: 6, paddingLeft: 8
            }}>CTC XLSM Export Logs</summary>
            <pre className="log">{this.ctc_xls_logs}</pre>
          </details>
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
    let args = [
      "a=" + encodeURIComponent(report.a.id),
      "b=" + encodeURIComponent(report.b.id),
      "codec_a="+ encodeURIComponent(report.a.codec),
      "codec_b="+ encodeURIComponent(report.b.codec)
      ];
    let csvExportUrl = baseUrl + "ctc_report.xlsm?" + args.join("&");
      return <Panel header={`BD Rate Report ${report.a.selectedName + " " + report.a.id} → ${report.b.selectedName + " " + report.b.id}`}>
        <div style={{ paddingBottom: 8, paddingTop: 4 }}>
          <Button active={this.state.reversed} onClick={this.onReverseClick.bind(this)} >Reverse</Button>{' '}
          <Button onClick={this.onTextReportClick.bind(this)} >Get Text Report</Button>
          <Button href={csvExportUrl} >Get CTC Report</Button>
          <FormGroup>
            <Select clearable={false} value={this.state.range} onChange={this.onChangeRange.bind(this)} options={rangeOptions} placeholder="Range">
            </Select>
            <Select clearable={false} value={this.state.interpolation} onChange={this.onChangeInterpolation.bind(this)} options={interpolationOptions} placeholder="interpolation">
            </Select>
            <details style={{
              position: 'relative',
              top: 4,
              fontFamily: "'Roboto Mono',monospace",
              fontSize: 12,
            }} open>
              <summary className="Select-control" style={{
                paddingBottom: 8,
                paddingTop: 6, paddingLeft: 8
              }}>CTC XLSM Export Logs</summary>
              <pre className="log">{this.ctc_xls_logs}</pre>
            </details>
          </FormGroup>
        </div>
        {errors}
        {textReport}
        <div style={{overflowX: "scroll"}}>
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
