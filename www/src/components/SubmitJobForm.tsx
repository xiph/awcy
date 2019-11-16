import * as React from "react";
import { Checkbox, Form, FormGroup, ControlLabel, FormControl, Button, ButtonToolbar} from "react-bootstrap";
import { formatDate, appStore, AppDispatcher, Action, Jobs, Job, JobStatus, JobProgress, timeSince, minutesSince } from "../stores/Stores";
import { Option } from "./Widgets"

declare var require: any;
let Select = require('react-select');

export class SubmitJobFormComponent extends React.Component<{
  onCreate: (job: Job) => void;
  onCancel: () => void;
  template?: Job;
}, {
    job: Job;
    set: Option;
    codec: Option;
  }> {
  constructor() {
    super();
  }
  componentWillMount() {
    let job = new Job();
    if (this.props.template) {
      let template = this.props.template;
      job.codec = template.codec;
      job.commit = template.commit;
      job.buildOptions = template.buildOptions;
      job.extraOptions = template.extraOptions;
      job.nick = template.nick;
      job.qualities = template.qualities;
      job.id = template.id;
      if (job.id.indexOf("@") > 0) {
        job.id = job.id.substr(0, job.id.indexOf("@"));
      }
      job.task = template.task;
      job.taskType = template.taskType;
    }
    let task = job.task ? job.task : "objective-1-fast";
    let codec = job.codec ? job.codec : "av1";
    job.id += "@" + formatDate(new Date());
    this.state = {
      job: null,
      set: {label: task, value: task},
      codec: {label: Job.codecs[codec], value: codec}
    } as any;
    job.saveEncodedFiles = true;
    this.setState({ job } as any);
  }
  getValidationState(name?: string): "success" | "warning" | "error" {
    function checkCli(cli: string) {
      if (cli == "") return true;
      return cli.split(" ").every(arg => {
        return arg.indexOf("--") == 0;
      });
    }
    let job = this.state.job;
    switch (name) {
      case "all":
        return ["id", "commit", "codec", "set", "nick", "qualities"].every(name =>
          (this.getValidationState(name) === "success")
        ) ? "success" : "error";
      case "id":
        if (job.id) {
          if (appStore.findJob(job.id)) {
            return "error";
          }
          return "success";
        }
        break;
      case "commit":
        let commit = job.commit.toLowerCase().trim();
        if (commit.length >= 7 && commit.length <= 40) {
          for (let i = 0; i < commit.length; i++) {
            if ("abcdef0123456789".indexOf(commit[i]) < 0) {
              return "error";
            }
          }
          return "success";
        }
        break;
      case "codec":
        if (this.state.codec.value) return "success";
        break;
      case "set":
        if (this.state.set.value) return "success";
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
      case "extra":
        return checkCli(job.extraOptions) ? "success" : "warning";
      case "build":
        return checkCli(job.buildOptions) ? "success" : "warning";
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
    job.task = this.state.set.value;
    job.codec = this.state.codec.value;
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
        <FormControl type="text" placeholder="ID"
          value={job.id} onChange={this.onInputChange.bind(this, "id")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("commit")}>
        <FormControl type="text" placeholder="Git Commit Hash e.g. 9368c05596d517c280146a1b815ec0ecc25e787c"
          value={job.commit} onChange={this.onInputChange.bind(this, "commit")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("codec")}>
        <ControlLabel>Codec</ControlLabel>
        <Select clearable={false} placeholder="Encoder" value={this.state.codec} options={codecOptions} onChange={this.onChangeCodec.bind(this)} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("set")}>
        <ControlLabel>Set</ControlLabel>
        <Select clearable={false} placeholder="Set" value={this.state.set} options={setOptions} onChange={this.onChangeSet.bind(this)} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("extra")}>
        <ControlLabel>Extra CLI Options</ControlLabel>
        <FormControl type="text" placeholder="Extra CLI Options"
          value={job.extraOptions} onChange={this.onInputChange.bind(this, "extraOptions")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("build")}>
      <ControlLabel>Extra Build Options (experiments)</ControlLabel>
        <FormControl type="text" placeholder="Extra Build Options"
          value={job.buildOptions} onChange={this.onInputChange.bind(this, "buildOptions")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("nick")}>
        <ControlLabel>Your name or IRC nick</ControlLabel>
        <FormControl type="text" placeholder="(auto-notifies on #daala)"
          value={job.nick} onChange={this.onInputChange.bind(this, "nick")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("qualities")}>
        <ControlLabel>Custom qualities (optional)</ControlLabel>
        <FormControl type="text" placeholder="30 40 50 ..."
          value={job.qualities} onChange={this.onInputChange.bind(this, "qualities")} />
      </FormGroup>

      <FormGroup>
        <ButtonToolbar>
          <Button bsSize="small" disabled={this.getValidationState("all") === "error"} bsStyle="success" onClick={this.onCreate.bind(this)}>Submit</Button>
          <Button bsSize="small" bsStyle="danger" onClick={this.onCancel.bind(this)}>Cancel</Button>
        </ButtonToolbar>
      </FormGroup>
    </Form>
  }
}
