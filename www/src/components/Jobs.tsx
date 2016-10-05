import * as React from "react";
import { ListGroup, ListGroupItem } from "react-bootstrap";
import { Popover, OverlayTrigger, Navbar, Checkbox, Form, FormGroup, ControlLabel, FormControl, HelpBlock, Modal, Panel, Label, Col, Row, Button, ProgressBar, Badge, ButtonToolbar, DropdownButton, MenuItem } from "react-bootstrap";
import { AppDispatcher, Action, SelectJob, DeselectJob, CancelJob, SubmitJob , AppStore, Jobs, Job, JobStatus, JobProgress, timeSince, minutesSince } from "../stores/Stores";
import { Option } from "./Widgets"
declare var require: any;
let Select = require('react-select');

declare var tinycolor: any;

interface JobListItemProps {
  store: AppStore,
  job: Job;
  detailed?: boolean;
  onCancel?: (job: Job) => void;
}

export class JobListItemComponent extends React.Component<JobListItemProps, {
    job: Job,
    showCancelModal: boolean;
    hasReport: undefined | boolean;
    hasAnalyzer: undefined | boolean;
  }> {

  onChangeHandler: any;
  constructor(props: JobListItemProps) {
    super();
    this.state = {
      job: props.job,
      showCancelModal: false,
      hasReport: undefined,
      hasAnalyzer: undefined
    };
    this.onChangeHandler = () => {
      this.forceUpdate();
    };
  }
  componentWillMount() {
    this.props.job.onChange.attach(this.onChangeHandler);
  }
  componentWillUnmount() {
    this.props.job.onChange.detach(this.onChangeHandler);
  }
  onCancelClick() {
    this.setState({ showCancelModal: true } as any);
  }
  onToggleSelectionClick() {
    let job = this.state.job;
    if (job.selected) {
      AppDispatcher.dispatch(new DeselectJob(this.state.job));
    } else {
      AppDispatcher.dispatch(new SelectJob(this.state.job));
    }
    // Check analyzer and report status.
    job.hasAnalyzer().then(result => {
      this.setState({hasAnalyzer: result} as any);
    });
    job.hasReport().then(result => {
      this.setState({hasReport: result} as any);
    });
  }
  abortCancel() {
    this.setState({ showCancelModal: false } as any);
  }
  confirmCancel() {
    this.abortCancel();
    this.props.onCancel(this.state.job);
  }
  render() {
    let job = this.props.job;
    let progress = null;
    if (job.status === JobStatus.Running) {
      let value = job.progress.total ? job.progress.value / job.progress.total : 0;
      let label = `${job.progress.value} of ${job.progress.total}`;
      let elapsed = minutesSince(job.date);
      let remaining = Math.round(elapsed / value - elapsed);
      label += " (" + remaining + "m left)";
      progress = <ProgressBar active now={100 * value} label={label} />
    } else if (job.status === JobStatus.Pending) {
      progress = <ProgressBar now={0} />
    }
    let details = null;
    let cancel = null;
    let select = null;
    if (job.status == JobStatus.Pending || job.status == JobStatus.Running) {
      if (this.props.onCancel) {
        cancel = <Button bsStyle="danger" disabled={!this.props.store.isLoggedIn} onClick={this.onCancelClick.bind(this)}>Cancel</Button>;
      }
    } else {
      select = <Button onClick={this.onToggleSelectionClick.bind(this)}>{job.selected ? "Deselect " + job.selectedName : "Select"}</Button>
    }
    let hasCompleted = null;
    if (!job.completed && job.status !== JobStatus.Running) {
      hasCompleted = <div className="jobWarning">Job failed.</div>
    }
    let hasAnalyzer = null;
    if (this.state.hasAnalyzer !== undefined) {
      if (this.state.hasAnalyzer === false) {
        hasAnalyzer = <div className="jobWarning">Analyzer failed to build.</div>
      }
    }
    let hasReport = null;
    if (this.state.hasReport !== undefined) {
      if (this.state.hasReport === false) {
        hasReport = <div className="jobWarning">Report failed to build or is not yet available.</div>
      }
    }
    let date = job.date ? `${job.date.toLocaleDateString()} ${job.date.toLocaleTimeString()} (${timeSince(job.date)})`: "";
    let borderRight = job.selected ? "4px solid " + job.color : undefined;
    let backgroundColor = (job.buildOptions === "" && job.extraOptions === "") ? "#FBFBFB": "";
    if (job.selected) {
      backgroundColor = "#F0F0F0";
    }
    let extra = [];
    if (job.buildOptions) extra.push("Build: " + job.buildOptions);
    if (job.extraOptions) extra.push("Extra: " + job.extraOptions);
    if (this.props.detailed) {
      extra.push("Qualities: " + job.qualities);
      extra.push("Run A/B Compare: " + job.runABCompare);
      extra.push("Save Encoded Files: " + job.saveEncodedFiles);
    }
    return <div className="list-group-item" style={{ borderRight, backgroundColor}}>
      <Modal show={this.state.showCancelModal} onHide={this.abortCancel.bind(this)}>
        <Modal.Header closeButton>
          <Modal.Title>Cancel job?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h5>Are you sure you want to cancel {this.state.job.id}?</h5>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.confirmCancel.bind(this)}>Yes</Button>
          <Button onClick={this.abortCancel.bind(this)}>No</Button>
        </Modal.Footer>
      </Modal>
      {hasCompleted}
      {hasAnalyzer}
      {hasReport}
      {progress}
      <div className="jobValue">{job.id}</div>
      <div className="tinyJobValue">
        {job.nick}, {job.codec}, {job.commit}
      </div>
      <div className="tinyJobValue">
        {date}
      </div>
      <div className="tinyJobValue">
        {extra.join(", ")}
      </div>
      <ButtonToolbar style={{ paddingTop: 8 }}>
        {cancel}
        {select}
      </ButtonToolbar>
    </div>;
  }
}

export class SubmitJobFormComponent extends React.Component<{
  onCreate: (job: Job) => void;
  onCancel: () => void;
}, {
    job: Job;
    set: string;
    codec: string;
  }> {
  constructor() {
    super();
    this.state = {
      job: null,
      set: "objective-1-fast",
      codec: "av1"
    } as any;
  }
  componentWillMount() {
    let job = new Job();
    job.saveEncodedFiles = true;
    this.setState({ job } as any);
  }
  getValidationState(name?: string): "success" | "warning" | "error" {
    let job = this.state.job;
    switch (name) {
      case "all":
        return ["id", "commit", "codec", "set", "nick", "qualities"].every(name =>
          (this.getValidationState(name) === "success")
        ) ? "success" : "error";
      case "id":
        if (job.id) {
          return "success";
        }
        break;
      case "commit":
        let commit = job.commit.toLowerCase().trim();
        if (commit.length == 40) {
          for (let i = 0; i < commit.length; i++) {
            if ("abcdef0123456789".indexOf(commit[i]) < 0) {
              return "error";
            }
          }
          return "success";
        }
        break;
      case "codec":
        if (this.state.codec) return "success";
        break;
      case "set":
        if (this.state.set) return "success";
        break;
      case "nick":
        if (job.nick) return "success";
        break;
      case "qualities":
        if (job.qualities.length === 0) {
          return "success";
        } else {
          if (job.qualities.split(" ").every((quality, index, array) => {
            let v = Number(quality);
            return (v | 0) === v;
          })) {
            return "success";
          }
        }
        break;
    }
    return "error";
  }
  onInputChange(key: string, e: any) {
    let job = this.state.job;
    if (e.target.type === "checkbox") {
      job[key] = e.target.checked;
    } else {
      job[key] = e.target.value;
    }
    this.setState({ job } as any);
  }
  onCreate() {
    let job = this.state.job;
    job.date = new Date();
    job.task = this.state.set;
    job.codec = this.state.codec;
    this.props.onCreate(job);
  }
  onCancel() {
    this.props.onCancel();
  }
  onChangeCodec(codec: Option) {
    this.setState({ codec } as any, () => { });
  }

  onChangeSet(set: Option) {
    this.setState({ set } as any, () => { });
  }

  onChangeAuthor(author: Option) {
    this.setState({ author } as any, () => { });
  }

  onChangeConfigs(configs: Option) {
    this.setState({ configs } as any, () => { });
  }
  render() {
    let job = this.state.job;

    let codecOptions = [];
    for (let key in Job.codecs) {
      let name = Job.codecs[key];
      codecOptions.push({ value: key, label: name });
    }

    let setOptions = [];
    for (let key in Job.sets) {
      let set = Job.sets[key];
      setOptions.push({ value: key, label: key });
    }

    return <Form>
      <FormGroup validationState={this.getValidationState("id")}>
        <ControlLabel>ID</ControlLabel>
        <FormControl type="text" placeholder=""
          value={job.id} onChange={this.onInputChange.bind(this, "id")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("commit")}>
        <ControlLabel>Git Commit Hash</ControlLabel>
        <FormControl type="text" placeholder="e.g. 9368c05596d517c280146a1b815ec0ecc25e787c"
          value={job.commit} onChange={this.onInputChange.bind(this, "commit")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("codec")}>
        <ControlLabel>Codec</ControlLabel>
        <Select placeholder="Codec" value={this.state.codec} options={codecOptions} onChange={this.onChangeCodec.bind(this)} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("set")}>
        <ControlLabel>Set</ControlLabel>
        <Select placeholder="Set" value={this.state.set} options={setOptions} onChange={this.onChangeSet.bind(this)} />
      </FormGroup>

      <FormGroup>
        <ControlLabel>Extra CLI Options</ControlLabel>
        <FormControl type="text"
          value={job.extraOptions} onChange={this.onInputChange.bind(this, "extraOptions")} />
      </FormGroup>

      <FormGroup>
        <ControlLabel>Extra Build Options</ControlLabel>
        <FormControl type="text"
          value={job.buildOptions} onChange={this.onInputChange.bind(this, "buildOptions")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("nick")}>
        <ControlLabel>Your IRC nick (for auto-notifications on #daala)</ControlLabel>
        <FormControl type="text"
          value={job.nick} onChange={this.onInputChange.bind(this, "nick")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("qualities")}>
        <ControlLabel>Custom Qualities</ControlLabel>
        <FormControl type="text" placeholder="30 40 50 ..."
          value={job.qualities} onChange={this.onInputChange.bind(this, "qualities")} />
      </FormGroup>

      <FormGroup>
        <ButtonToolbar>
          <Button disabled={this.getValidationState("all") === "error"} bsStyle="success" onClick={this.onCreate.bind(this)}>Submit</Button>
          <Button bsStyle="danger" onClick={this.onCancel.bind(this)}>Cancel</Button>
        </ButtonToolbar>
      </FormGroup>
    </Form>
  }
}

interface JobListProps {
  store: AppStore;
  jobs: Jobs;
  jobStatusFilter?: JobStatus;
  detailed?: boolean;
  listHeight: number
}

export class JobListComponent extends React.Component<JobListProps, {
    store: AppStore,
    jobs: Job[];
    jobStatusFilter: JobStatus;
    showSubmitJobForm: boolean;
    set: Option;
    codec: Option;
    author: Option;
    configs: Option[];
  }> {
  constructor(props: JobListProps) {
    super();
    this.state = {
      jobs: [],
      jobStatusFilter: props.jobStatusFilter,
      showSubmitJobForm: false,
    } as any;
  }

  componentDidMount() {
    this.props.jobs.onChange.attach(() => {
      this.setState({ jobs: this.props.jobs.jobs } as any);
    });
  }

  onChangeCodec(codec: Option) {
    this.setState({ codec } as any, () => { });
  }

  onChangeSet(set: Option) {
    this.setState({ set } as any, () => { });
  }

  onChangeAuthor(author: Option) {
    this.setState({ author } as any, () => { });
  }

  onChangeConfigs(configs: Option) {
    this.setState({ configs } as any, () => { });
  }

  onCancelJob(job: Job) {
    AppDispatcher.dispatch(new CancelJob(job));
  }

  onSubmitNewJobClick() {
    this.setState({ showSubmitJobForm: true } as any);
  }

  makeJobList() {
    let jobs = this.state.jobs;

    let codecOptions = [];
    for (let key in Job.codecs) {
      let name = Job.codecs[key];
      codecOptions.push({ value: key, label: name });
    }

    let setOptions = [];
    for (let key in Job.sets) {
      let set = Job.sets[key];
      setOptions.push({ value: key, label: key });
    }

    let authorOptions = [];
    let configOptions = [];
    let uniqueAuthors = [];
    let uniqueBuildsFlags = [];
    jobs.forEach(job => {
      if (uniqueAuthors.indexOf(job.nick) < 0) {
        uniqueAuthors.push(job.nick);
      }
      let flags = job.buildOptions.trim().split(" ");
      flags.forEach(flag => {
        if (flag && uniqueBuildsFlags.indexOf(flag) < 0) {
          uniqueBuildsFlags.push(flag);
        }
      })
    });
    configOptions = uniqueBuildsFlags.map(option => {
      return { value: option, label: option };
    });
    authorOptions = uniqueAuthors.map(author => {
      return { value: author, label: author };
    });

    return <div>
      <div style={{ width: "100%", paddingBottom: "10px" }}>
        <Button bsStyle="success" disabled={!this.props.store.isLoggedIn} onClick={this.onSubmitNewJobClick.bind(this)}>Submit New Job</Button>
      </div>
      <div style={{ display: "table", width: "100%" }}>
        <div style={{ display: "table-row" }}>
          <div style={{ display: "table-cell", paddingRight: "5px" }}>
            <Select placeholder="Codec" value={this.state.codec} options={codecOptions} onChange={this.onChangeCodec.bind(this)} />
          </div>
          <div style={{ display: "table-cell", paddingLeft: "5px", paddingRight: "5px" }}>
            <Select placeholder="Set" value={this.state.set} options={setOptions} onChange={this.onChangeSet.bind(this)} />
          </div>
          <div style={{ display: "table-cell", paddingLeft: "5px" }}>
            <Select placeholder="Author" value={this.state.author} options={authorOptions} onChange={this.onChangeAuthor.bind(this)} />
          </div>
        </div>
      </div>
      <div style={{ width: "100%", paddingTop: "10px", paddingBottom: "10px" }}>
        <Select multi placeholder="Config" value={this.state.configs} options={configOptions} onChange={this.onChangeConfigs.bind(this)} />
      </div>
      <div style={{bottom: 0, height: this.props.listHeight, overflow: "scroll", overflowX: "hidden"}}>
        <ListGroup componentClass="ul">
          {jobs.filter((job: Job) => {
            if (!(job.status & this.state.jobStatusFilter)) {
              return false;
            }
            if (this.state.author && job.nick != this.state.author.value) {
              return false;
            }
            if (this.state.set && job.task != this.state.set.value) {
              return false;
            }
            if (this.state.codec && job.codec != this.state.codec.value) {
              return false;
            }
            if (this.state.configs) {
              if (!this.state.configs.every(option => job.buildOptions.indexOf(option.value) >= 0)) {
                return false;
              }
            }
            return true;
          }).map((job: Job) => {
            return <JobListItemComponent store={this.props.store} detailed={this.props.detailed} key={job.id} job={job} onCancel={this.onCancelJob.bind(this)}></JobListItemComponent>
          })}
        </ListGroup>
      </div>
    </div>
  }

  hideSubmitJobForm() {
    this.setState({ showSubmitJobForm: false } as any);
  }
  onSubmitJob(job: Job) {
    this.hideSubmitJobForm();
    AppDispatcher.dispatch(new SubmitJob(job));
  }
  render() {
    console.debug("Rendering Job List");
    if (this.state.showSubmitJobForm) {
      return <SubmitJobFormComponent onCreate={this.onSubmitJob.bind(this)} onCancel={this.hideSubmitJobForm.bind(this)} />
    } else {
      return this.makeJobList();
    }
  }
}


