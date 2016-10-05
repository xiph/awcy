import * as React from "react";
import { Checkbox, Form, FormGroup, ControlLabel, FormControl, Button, ButtonToolbar} from "react-bootstrap";
import { appStore, AppDispatcher, Action, Jobs, Job, JobStatus, JobProgress, timeSince, minutesSince } from "../stores/Stores";
import { Option } from "./Widgets"

declare var require: any;
let Select = require('react-select');

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
          if (appStore.findJob(job.id)) {
            return "error";
          }
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
        <FormControl type="text" placeholder="ID"
          value={job.id} onChange={this.onInputChange.bind(this, "id")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("commit")}>
        <FormControl type="text" placeholder="Git Commit Hash e.g. 9368c05596d517c280146a1b815ec0ecc25e787c"
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
        <FormControl type="text" placeholder="Extra CLI Options"
          value={job.extraOptions} onChange={this.onInputChange.bind(this, "extraOptions")} />
      </FormGroup>

      <FormGroup>
        <FormControl type="text" placeholder="Extra Build Options"
          value={job.buildOptions} onChange={this.onInputChange.bind(this, "buildOptions")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("nick")}>
        <FormControl type="text" placeholder="Your IRC nick (for auto-notifications on #daala)"
          value={job.nick} onChange={this.onInputChange.bind(this, "nick")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("qualities")}>
        <FormControl type="text" placeholder="Custom Qualities 30 40 50 ..."
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