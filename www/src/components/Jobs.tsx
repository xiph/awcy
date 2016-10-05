import * as React from "react";
import { ListGroup, Checkbox, Form, FormGroup, ControlLabel, FormControl, Button, ButtonToolbar} from "react-bootstrap";
import { appStore, CancelJob, SubmitJob, AppDispatcher, Action, Jobs, Job, JobStatus, JobProgress, timeSince, minutesSince } from "../stores/Stores";
import { Option } from "./Widgets"

import { JobComponent } from "./Job"
import { SubmitJobFormComponent } from "./SubmitJobForm"

declare var require: any;
let Select = require('react-select');

declare var tinycolor: any;

interface JobsProps {
  jobs: Jobs;
  jobStatusFilter?: JobStatus;
  detailed?: boolean;
  showFilters?: boolean;
  showCommands?: boolean;
  listHeight: number
}

export class JobsComponent extends React.Component<JobsProps, {
    jobStatusFilter: JobStatus;
    showSubmitJobForm: boolean;
    set: Option;
    codec: Option;
    author: Option;
    configs: Option[];
  }> {
  constructor(props: JobsProps) {
    super();
    this.state = {
      jobStatusFilter: props.jobStatusFilter,
      showSubmitJobForm: false,
    } as any;
  }

  componentDidMount() {
    this.props.jobs.onChange.attach(() => {
      this.forceUpdate();
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
  makeFilters() {
    let jobs = this.props.jobs.jobs;
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
    </div>
  }
  makeJobList() {
    let jobs = this.props.jobs.jobs;
    let filters = this.props.showFilters ? this.makeFilters() : null;
    let commands = this.props.showCommands ? <div style={{ width: "100%", paddingBottom: "10px" }}>
        <Button bsSize="small" bsStyle="success" disabled={!appStore.isLoggedIn} onClick={this.onSubmitNewJobClick.bind(this)}>Submit New Job</Button>
      </div> : null;
    return <div>
      {commands}
      {filters}
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
            return <JobComponent detailed={this.props.detailed} key={job.id} job={job} onCancel={this.onCancelJob.bind(this)}></JobComponent>
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