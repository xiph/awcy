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
    arch: Option;
    ctcSets: Option[];
    ctcPresets: Option[];
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
      job.arch = template.arch;
      job.ctcSets = template.ctcSets;
      job.ctcPresets = template.ctcPresets;
    }
    let task = job.task ? job.task : "objective-1-fast";
    let codec = job.codec ? job.codec : "av1";
    let arch = job.arch ? job.arch : "x86_64";
    job.id += "@" + formatDate(new Date());
    this.state = {
      job: null,
      set: {label: task, value: task},
      codec: {label: Job.codecs[codec], value: codec},
      arch: {label: job.arch, value: job.arch},
      ctcSets: job.ctcSets,
      ctcPresets: job.ctcPresets,
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
        let commit = job.commit.trim();
        if (commit.length === 41 && commit.charAt(0) === 'I') {
          return "error"; // Gerrit Change-ID format, not a git reference
        }
        if (job.commit) return "success";
      case "codec":
        if (this.state.codec.value) return "success";
        break;
      case "set":
        if (this.state.set.value) {
          if (this.state.codec.value === "av2-as" || this.state.codec.value === "av2-as-st") {
            if (this.state.set.value === "aomctc-a1-4k-as") {
              return "success";
            } else {
              return "error";
            }
          }
          return "success";
        }
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
      case "arch":
        if (job.arch) return "success";
        break;
      case "ctcSets":
        if (job.ctcSets) return "success";
        break;
      case "ctcPresets":
        if (job.ctcPresets) return "success";
        break;
    }
    return "error";
  }
  onCtcSetsSelection(ctcSets: Option) {
    this.setState({ ctcSets } as any, () => { });
  }
  onCtcPresetsSelection(ctcPresets: Option) {
    this.setState({ ctcPresets } as any, () => { });
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
    job.arch = this.state.arch.value;
    const checkAllSets = obj => obj.value === 'aomctc-all';
    const checkAllPresets = obj => obj.value === 'av2-all';
    const checkMandatorySets = obj => obj.value === 'aomctc-mandatory';
    // Case: CTC Sets
    if (typeof (this.state.ctcSets) !== 'undefined') {
      // Case 1: No CTC Sets
      if (this.state.ctcSets.length == 0) {
        job.ctcSets = []
      }
      // Case 2: If user has mandatory set, push only that
      else if (this.state.ctcSets.some(checkMandatorySets)) {
        job.ctcSets = []
        job.task = 'aomctc-a2-2k';
        job.ctcSets.push('aomctc-mandatory')
      }
      // Case 3: If user has all set, push only that, ignore rest
      else if (this.state.ctcSets.some(checkAllSets)) {
        job.ctcSets = []
        job.task = 'aomctc-a2-2k';
        job.ctcSets.push('aomctc-all')
      }
      // Case 4: Creating/Cloning an existing job,
      // For cloning, we compare by converitng to string
      else if (JSON.stringify(job.ctcSets) != JSON.stringify(this.state.ctcSets)) {
        // Explictly setting Jobs CTCSet List to Zero, and write the
        // values from the current State's List.
        job.ctcSets = []
        for (var i = 0; i < this.state.ctcSets.length; i++) {
          // Push only the actual CTC set names and skip pushing labels.
          job.ctcSets.push(this.state.ctcSets[i].value);
        }
        // Sort the sets, so higher res will be encoded first.
        job.ctcSets = job.ctcSets.sort()
        // As we have multiple sets, the frontend will render only the highest
        // prority set now.
        job.task = this.state.ctcSets[0].value;

      }
    }
    // Case: CTC Presets
    if (typeof (this.state.ctcPresets) !== 'undefined') {
      // Case 1: No CTC Presets
      if (this.state.ctcPresets.length == 0) {
        job.ctcPresets = []
      }
      // Case 2: If user has all preset, push only that, ignore rest
      else if (this.state.ctcPresets.some(checkAllPresets)) {
        job.ctcPresets = []
        job.codec = 'av2-ra-st';
        job.ctcPresets.push('av2-all')
      }
      // Case 3: Creating/Cloning an existing job,
      // For cloning, we compare by converting to string
      else if (JSON.stringify(job.ctcPresets) != JSON.stringify(this.state.ctcPresets)) {
        // Explictly setting Jobs ctcPresets List to Zero, and write the
        // values from the current State's List.
        job.ctcPresets = []
        for (var i = 0; i < this.state.ctcPresets.length; i++) {
          // Push only the actual CTC preset names and skip pushing labels.
          job.ctcPresets.push(this.state.ctcPresets[i].value);
        }
        // As we have multiple sets, the frontend will render only the first
        // preset now.
        job.codec = this.state.ctcPresets[0].value;
      }
    }
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

  onChangeArch(arch: Option) {
    this.setState({ arch } as any, () => { });
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

    const archOptions = [{value: 'x86_64', label: 'x86_64'}, {value: 'aarch64', label: 'aarch64'}];
    // CTC: Create a user-friendly CTC set list.
    const ctcOptions = [{ value: 'aomctc-a1-4k', label: 'A1' }, { value: 'aomctc-a2-2k', label: 'A2' }, { value: 'aomctc-a3-720p', label: 'A3' }, { value: 'aomctc-a4-360p', label: 'A4' }, { value: 'aomctc-a5-270p', label: 'A5' }, { value: 'aomctc-b1-syn', label: 'B1' }, { value: 'aomctc-b2-syn', label: 'B2' }, { value: 'aomctc-f1-hires', label: 'F1' }, { value: 'aomctc-f2-midres', label: 'F2' }, { value: 'aomctc-g1-hdr-4k', label: 'G1' }, { value: 'aomctc-g2-hdr-2k', label: 'G2' }, { value: 'aomctc-e-nonpristine', label: 'E' }, { value: 'aomctc-all', label: 'All' }, { value: 'aomctc-mandatory', label: 'Mandatory' }];
    const ctcPresetOptions = [{ value: 'av2-ra-st', label: 'RA' }, { value: 'av2-ai', label: 'AI' }, { value: 'av2-ld', label: 'LD' }, { value: 'av2-all', label: 'All' }];

    return <Form>
      <FormGroup validationState={this.getValidationState("id")}>
        <FormControl type="text" placeholder="ID"
          value={job.id} onChange={this.onInputChange.bind(this, "id")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("commit")}>
        <FormControl type="text" placeholder="Git Commit Reference (Hash/Branch/Tag)"
          value={job.commit} onChange={this.onInputChange.bind(this, "commit")} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("codec")}>
        <ControlLabel>Encoder</ControlLabel>
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

      <FormGroup validationState={this.getValidationState("arch")}>
        <ControlLabel>Architecture</ControlLabel>
        <Select clearable={false} placeholder="Encoder" value={this.state.arch} options={archOptions} onChange={this.onChangeArch.bind(this)} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("ctcSets")}>
        <ControlLabel>This will override the above set (for AOM-CTC)</ControlLabel>
        <Select multi placeholder="CTC Sets" value={this.state.ctcSets} options={ctcOptions} onChange={this.onCtcSetsSelection.bind(this)} />
      </FormGroup>

      <FormGroup validationState={this.getValidationState("ctcPresets")}>
        <ControlLabel>This will override the above preset (for AOM-CTC)</ControlLabel>
        <Select multi placeholder="CTC Presets" value={this.state.ctcPresets} options={ctcPresetOptions} onChange={this.onCtcPresetsSelection.bind(this)} />
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
