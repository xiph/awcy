import { Dispatcher } from "flux";
import { Analyzer } from "../analyzer";

export var AppDispatcher = new Dispatcher<Action>();
export class Action { }
export class SelectJob extends Action {
  constructor(public job: Job) {
    super();
  }
}
export class DeselectJob extends Action {
  constructor(public job: Job) { super(); }
}
export class CancelJob extends Action {
  constructor(public job: Job) { super(); }
}
export class SubmitJob extends Action {
  constructor(public job: Job) { super(); }
}
export class AnalyzeFile extends Action {
  constructor(public decoderUrl: string, public fileUrl: string) { super(); }
}


import { AnalyzerComponent } from "../components/Widgets";
import { Promise } from "es6-promise"
import { AsyncEvent } from 'ts-events';

let baseUrl = "https://arewecompressedyet.com/";
// let baseUrl = "https://beta.arewecompressedyet.com/";

function zip<T>(a: string[], b: T[]): { [index: string]: T } {
  let o = {};
  for (let i = 0; i < a.length; i++) {
    o[a[i]] = b[i];
  }
  return o;
}

export function postXHR(path: string, o: any): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    let pairs = [];
    for(let name in o) {
      if (o[name]) {
        pairs.push(encodeURIComponent(name) + '=' + encodeURIComponent(o[name]));
      }
    }
    let data = pairs.join('&').replace(/%20/g, '+');
    xhr.open('POST', path);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.addEventListener('load', function(event) {
      resolve(xhr.status === 200);
    });
    xhr.addEventListener('error', function(event) {
      reject(false);
    });
    xhr.send(data);
  });
}
export function loadXHR(path: string, next: (json: any) => void, type = "json") {
  let xhr = new XMLHttpRequest();
  let self = this;
  xhr.open("GET", path, true);
  xhr.responseType = "text";
  xhr.send();

  xhr.addEventListener("load", function () {
    if (xhr.status != 200) {
      console.error("Failed to load XHR: " + path);
      return;
    }
    console.info("Loaded XHR: " + path);
    let response = this.responseText;
    if (type === "json") {
      response = response.replace(/NaN/g, "null");
      response = response ? JSON.parse(response) : null;
    }
    next(response);
  });
}

export function fileExists(url: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    let self = this;
    xhr.open("HEAD", url, true);
    xhr.send();
    xhr.addEventListener("load", function () {
      if (xhr.status != 404) {
        resolve(true);
      }
      resolve(false);
    });
  });
}

export function daysSince(date: Date) {
  var oneSecond = 1000;
  var oneMinute = 60 * oneSecond;
  var oneHour = 60 * oneMinute;
  var oneDay = 24 * oneHour;
  let diff = new Date().getTime() - date.getTime();
  return Math.round(Math.abs(diff / oneDay));
}

export function minutesSince(date: Date) {
  var oneSecond = 1000;
  var oneMinute = 60 * oneSecond;
  let diff = new Date().getTime() - date.getTime();
  return Math.round(Math.abs(diff / oneMinute));
}

export function timeSince(date: Date) {
  var oneSecond = 1000;
  var oneMinute = 60 * oneSecond;
  var oneHour = 60 * oneMinute;
  var oneDay = 24 * oneHour;
  let diff = new Date().getTime() - date.getTime();
  var days = Math.round(Math.abs(diff / oneDay));
  var hours = Math.round(Math.abs(diff % oneDay) / oneHour);
  let s = "";
  if (days > 0) {
    s += `${days} days, `
  }
  return s + `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export enum JobStatus {
  None = 0,
  Running = 1,
  Pending = 2,
  Completed = 4,
  All = Running | Pending | Completed
}

export enum ReportField {
  Q,
  Pixels,
  Size,
  PSNR_Y,
  PSNR_HVS,
  SSIM,
  FAST_SSIM,
  CIEDE_2000,
  PSNR_Cb,
  PSNR_Cr,
  APSNR_Y,
  APSNR_Cb,
  APSNR_Cr,
  MSSSIM,
  Time
}

export type Report = { [name: string]: number[][] };

export type BDRateReportJSON = {
  metric_names: string[],
  average: {
    [index: string]: number
  },
  metric_data: {
    [name: string]: {
      [index: string]: number
    }
  }
};

export class BDRateReport {
  a: Job;
  b: Job;
  average: { [name: string]: number }
  metrics: {
    [video: string]: {
      [name: string]: number
    }
  };
  metricNames: string [];
  static fromJSON(a: Job, b: Job, json: BDRateReportJSON): BDRateReport {
    function toMap(data: { [index: string]: number }, names: string[]) {
      return zip(names, names.map((name, i) => data[i]))
    }
    let report = new BDRateReport();
    let names = json.metric_names.map((name) => {
      switch (name) {
        case "CIEDE2000": return "CIEDE 2000";
        case "PSNRHVS": return "PSNR HVS";
        case "MSSSIM": return "MS SSIM";
      }
      return name;
    });
    report.a = a;
    report.b = b;
    report.average = toMap(json.average, names);
    report.metrics = { };
    let videos = [];
    for (let k in json.metric_data) {
      videos.push(k);
    }
    videos.sort();
    videos.forEach((video) => {
      report.metrics[video] = toMap(json.metric_data[video], names)
    });
    // TODO AWCY returns an extra column.
    report.metricNames = names.slice(0, 10);
    return report;
  }
}

export let metricNames = [
  "PSNR Y", "PSNR HVS", "SSIM", "FAST SSIM", "CIEDE 2000",
  "PSNR Cb", "PSNR Cr", "APSNR Y", "APSNR Cb", "APSNR Cr",
  "MSSSIM", "Time"
];

export let reportFieldNames = [
  "Q", "Pixels", "Size"
].concat(metricNames);

export function metricNameToReportFieldIndex(name: string) {
  return 3 + metricNames.indexOf(name);
}

export class JobProgress {
  constructor(
    public value: number,
    public total: number) {
    // ...
  }
}
export class Job {
  codec: string = "";
  commit: string = "";
  buildOptions: string = "";
  extraOptions: string = "";
  nick: string = "";
  qualities: string = "";
  id: string = "";
  task: string = "";
  taskType: string = "";
  runABCompare: boolean = false;
  saveEncodedFiles: boolean = false;
  status: JobStatus = JobStatus.None;
  date: Date;
  completed: boolean;
  log: string = "";
  progress: JobProgress = new JobProgress(0, 0);
  selected: boolean = false;
  selectedName: string = "";
  color: string = "";
  onChange = new AsyncEvent<string>();

  constructor() {

  }

  loadLog(refresh = false): Promise<string> {
    if (this.log && !refresh) {
      return Promise.resolve(this.log);
    }
    return new Promise((resolve, reject) => {
      let path = baseUrl + `runs/${this.id}/output.txt`;
      loadXHR(path, (text) => {
        this.log = text;
        this.onChange.post("updated-log");
        resolve(text);
      }, "text");
    })
  }

  loadFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      loadXHR(path, (text) => {
        resolve(text);
      }, "text");
    });
  }

  loadFiles(paths: string[]): Promise<string[]> {
    return Promise.all(paths.map(path => this.loadFile(path)));
  }


  report: Report = null
  loadReport(): Promise<{ [name: string]: any }> {
    if (this.report) {
      return Promise.resolve(this.report);
    }

    // Total Report
    let names = ["Total"];
    let paths = [baseUrl + `runs/${this.id}/${this.task}/total.out`];

    // File Report
    names = names.concat(Job.sets[this.task].sources);
    paths = paths.concat(Job.sets[this.task].sources.map(name => {
      // TODO: Fix -daala suffix.
      return baseUrl + `runs/${this.id}/${this.task}/${name}-daala.out`;
    }));
    return this.loadFiles(paths).then(textArray => {
      let data = textArray.map(text => text.split("\n").filter(line => !!line).map(line => line.trim().split(" ").map(value => Number(value))));
      return this.report = zip(names, data);
    });
  }

  hasAnalyzer(): Promise<boolean> {
    return fileExists(baseUrl + `runs/${this.id}/js/decoder.js`);
  }

  hasReport(): Promise<boolean> {
    return fileExists(baseUrl + `runs/${this.id}/${this.task}/total.out`);
  }

  static fromJSON(json: any) {
    let job = new Job();
    job.id = json.run_id;
    job.nick = json.nick;
    job.qualities = json.qualities;
    job.buildOptions = json.build_options;
    job.codec = json.codec;
    job.commit = json.commit;
    job.extraOptions = json.extra_options;
    job.task = json.task;
    job.taskType = json.task_type;
    job.status = json.status;
    return job;
  }

  static codecs = {
    "daala": "Daala",
    "x264": "x264",
    "x265": "x265",
    "x265-rt": "x265 Realtime",
    "vp8": "VP8",
    "vp9": "VP9",
    "vp10": "VP10",
    "vp10-rt": "VP10 Realtime",
    "av1": "AV1 (High Latency CQP)",
    "av1-rt": "AV1 (Low Latency CQP)",
    "thor": "Thor",
    "thor-rt": "Thor Realtime"
  };

  static sets = {};
}

export class Jobs {
  jobs: Job[] = [];
  onChange = new AsyncEvent<string>();
  constructor() {
  }
  addJobInternal(job: Job) {
    if (this.jobs.indexOf(job) >= 0) {
      return;
    }
    this.jobs.push(job);
  }
  prependJob(job: Job) {
    if (this.jobs.indexOf(job) >= 0) {
      return;
    }
    this.jobs.unshift(job);
    this.onChange.post("job-added");
  }
  addJob(job: Job) {
    if (this.jobs.indexOf(job) >= 0) {
      return;
    }
    this.jobs.push(job);
    this.onChange.post("job-added");
  }
  removeJob(job: Job) {
    let index = this.jobs.indexOf(job);
    if (index >= 0) {
      this.jobs.splice(index, 1);
      this.onChange.post("job-removed");
    }
  }
  cancelAllJobs() {
    this.jobs = [];
    this.onChange.post("jobs-deleted");
  }
  getById(id: string) {
    for (let i = 0; i < this.jobs.length; i++) {
      if (this.jobs[i].id === id) {
        return this.jobs[i];
      }
    }
    return null;
  }
}

function forEachUrlParameter(callback: (key: string, value: string) => void) {
  let url = window.location.search.substring(1);
  url = url.replace(/\/$/, ""); // Replace / at the end that gets inserted by browsers.
  let params = {};
  url.split('&').forEach(function (s) {
    let t = s.split('=');
    callback(t[0], decodeURIComponent(t[1]));
  });
}

function getUrlParameters(): any {
  let params = {};
  forEachUrlParameter((key, value) => {
    params[key] = value;
  });
  return params;
};

let colorPool = [
  '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#b15928'
];

function getColorForString(s: string): string {
  let t = 0;
  for (let i = 0; i < s.length; i++) {
    t += s.charCodeAt(i);
  }
  return colorPool[t % colorPool.length];
}

let selectedNamePool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export class AppStore {
  jobs: Jobs;
  selectedJobs: Jobs;
  onChange = new AsyncEvent<string>();
  aws: any;
  onAWSChange = new AsyncEvent<string>();
  analyzedFiles = [];
  onAnalyzedFilesChanged = new AsyncEvent<string>();
  isLoggedIn: boolean = false;
  password: string = "";
  onLoggedInStateChanged = new AsyncEvent<string>();
  constructor() {
    this.jobs = new Jobs();
    this.selectedJobs = new Jobs();
    this.aws = {};
    AppDispatcher.register((action) => {
      if (action instanceof SelectJob) {
        let job = action.job;
        job.selected = true;
        job.selectedName = selectedNamePool.shift();
        job.color = getColorForString(job.id);
        job.onChange.post("job-changed");
        this.selectedJobs.addJob(job);
      } else if (action instanceof DeselectJob) {
        let job = action.job;
        selectedNamePool.unshift(job.selectedName);
        job.selected = false;
        job.selectedName = "";
        job.color = "";
        job.onChange.post("job-changed");
        this.selectedJobs.removeJob(job);
      } else if (action instanceof SubmitJob) {
        this.submitJob(action.job);
      } else if (action instanceof CancelJob) {
        this.cancelJob(action.job);
      } else if (action instanceof AnalyzeFile) {
        this.analyzedFiles.push({job: null, decoderUrl: "http://aomanalyzer.org/bin/decoder.js", videoUrl: "crosswalk_30.ivf"})
        this.onAnalyzedFilesChanged.post("change");
      }
    });
  }
  login(password: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.password = password;
      postXHR(baseUrl + "submit/check", {
        key: password
      }).then((result) => {
        this.isLoggedIn = result;
        this.onLoggedInStateChanged.post("changed");
        resolve(result);
        if (result) {
          localStorage["password"] = password;
        } else {
          delete localStorage["password"];
        }
      }, () => {
        this.isLoggedIn = false;
        this.onLoggedInStateChanged.post("changed");
        reject(false);
      });
    });
  }
  submitJob(job: Job) {
    postXHR(baseUrl + "submit/job", {
      key: this.password,
      run_id: job.id,
      commit: job.commit,
      codec: job.codec,
      task: job.task,
      extra_options: job.extraOptions,
      build_options: job.buildOptions,
      qualities: job.qualities,
      nick: job.nick,
      ab_compare: job.runABCompare,
      save_encode: job.saveEncodedFiles
    });
    job.status = JobStatus.Running;
    this.jobs.prependJob(job);
  }
  cancelJob(job: Job) {
    postXHR(baseUrl + "submit/cancel", {
      key: this.password,
      run_id: job.id,
    });
    this.jobs.removeJob(job);
  }

  load() {
    this.loadJobs().then(() => {
      this.loadAWS();
      this.loadSets();
      this.loadStatus();
      setInterval(() => {
        this.loadStatus();
      }, 10000);
    });

    if (localStorage["password"]) {
      this.login(localStorage["password"]);
    }

  }
  loadAWS() {
    loadXHR(baseUrl + "describeAutoScalingInstances", (json) => {
      if (!json) return;
      this.aws.AutoScalingInstances = json.AutoScalingInstances;
      this.onAWSChange.post("loaded");
    });
    loadXHR(baseUrl + "describeAutoScalingGroups", (json) => {
      if (!json) return;
      this.aws.AutoScalingGroups = json.AutoScalingGroups;
      this.onAWSChange.post("loaded");
    });
  }
  static bdRateReportCache: { [path: string]: BDRateReport } = {};
  static loadBDRateReport(a: Job, b: Job, set: string, method = "report-overlap"): Promise<BDRateReport> {
    let args = [
      "a=" + encodeURI(a.id),
      "b=" + encodeURI(b.id),
      "set=" + encodeURI(set),
      "method=" + encodeURI(method),
      "file=" + "REMOVEME",
      "format=json"
    ];
    let url = baseUrl + "bd_rate?" + args.join("&");
    if (AppStore.bdRateReportCache[url]) {
      let report = AppStore.bdRateReportCache[url];
      return Promise.resolve(report);
    }
    return new Promise((resolve, reject) => {
      loadXHR(url, (json) => {
        let report = BDRateReport.fromJSON(a, b, json);
        AppStore.bdRateReportCache[url] = report;
        resolve(report);
      })
    });
  }
  findJob(id: string): Job {
    return this.jobs.jobs.find((job) => job.id === id);
  }
  processUrlParameters() {
    forEachUrlParameter((key, value) => {
      if (key === "job") {
        let job = this.findJob(value);
        if (job) {
          AppDispatcher.dispatch(new SelectJob(job));
        }
      }
    });
  }
  loadStatus() {
    loadXHR(baseUrl + "run_status.json", (json) => {
      if (!json) return;
      json.forEach(o => {
        let job = this.findJob(o.run_id);
        if (!job) return;
        job.status = JobStatus.Running;
        job.progress.value = o.completed;
        job.progress.total = o.total;
        job.loadLog(true);
        job.onChange.post("updated status");
      });
    });
  }
  loadSets(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      loadXHR(baseUrl + "sets.json", (json) => {
        Job.sets = json;
        resolve(true);
      });
    });
  }

  loadJobs(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      loadXHR(baseUrl + "list.json", (json) => {
        json = json.filter(job => job.info.task === "objective-1-fast" && job.info.codec === "av1");
        json.sort(function (a, b) {
          return (new Date(b.date) as any) - (new Date(a.date) as any);
        });
        json = json.slice(0, 100);
        json.forEach(o => {
          let job = Job.fromJSON(o.info);
          job.date = new Date(o.date);
          job.completed = !o.failed;
          job.status = JobStatus.Completed;
          this.jobs.addJobInternal(job);
        });
        this.jobs.onChange.post("job-added");
        resolve(true);
        this.processUrlParameters();
      });
    });
  }
}
