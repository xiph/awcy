import * as React from "react";
import { Button, Table, Panel } from "react-bootstrap";
import { loadXHR, baseUrl, AppDispatcher, CancelJob, SubmitJob, SelectJob, DeselectJob, appStore, Job, Jobs, timeSince, daysSince, JobStatus} from "../stores/Stores";
import { JobComponent } from "./Job";
import { JobLogComponent } from "./JobLog";

export class DebugComponent extends React.Component<void, {
  log: string
}> {
  constructor() {
    super();
    this.state = { log: "" };
  }
  getRandomJob(filter: JobStatus) {
    let jobs = appStore.jobs.jobs;
    let count = 0;
    while (true) {
      let job = jobs[Math.random() * jobs.length | 0];
      if ((job.status & filter) === job.status) {
        return job;
      }
      count ++;
      if (count > 100) {
        return null;
      }
    }
  }
  onSubmitJobClick() {
    let job = new Job();
    job.id = "JOB:" + Math.random();
    job.date = new Date();
    AppDispatcher.dispatch(new SubmitJob(job));
  }
  onCancelJobClick() {
    let job = this.getRandomJob(JobStatus.Completed);
    if (job) AppDispatcher.dispatch(new CancelJob(job));
  }
  onSelectJobClick() {
    let job = this.getRandomJob(JobStatus.Completed);
    if (job) AppDispatcher.dispatch(new SelectJob(job));
  }
  onGetRunStatus() {
    loadXHR(baseUrl + "run_status.json", (json) => {
      this.setState({log: JSON.stringify(json, null, 2)});
    });
  }
  onGetBuildStatus() {
    loadXHR(baseUrl + "build_job_queue.json", (json) => {
      this.setState({log: JSON.stringify(json, null, 2)});
    });
  }
  onMachineUsage() {
    loadXHR(baseUrl + "machine_usage.json", (json) => {
      this.setState({log: JSON.stringify(json, null, 2)});
    });
  }
  onGetList() {
    loadXHR(baseUrl + "list.json", (json) => {
      this.setState({log: JSON.stringify(json, null, 2)});
    });
  }
  onPollClick() {
    appStore.poll();
  }
  render() {
    console.debug("Rendering Debug");
    // <Button onClick={this.onSubmitJobClick.bind(this)}>Submit Random Job</Button>{' '}
    // <Button onClick={this.onCancelJobClick.bind(this)}>Cancel Random Job</Button>{' '}
    // <Button onClick={this.onSelectJobClick.bind(this)}>Select Random Job</Button>{' '}
    return <div><Panel>
      <Button onClick={this.onPollClick.bind(this)}>Poll Server</Button>{' '}
      <Button onClick={this.onGetRunStatus.bind(this)}>Get run_status.json</Button>{' '}
      <Button onClick={this.onGetBuildStatus.bind(this)}>Get build_status.json</Button>{' '}
      <Button onClick={this.onGetList.bind(this)}>Get list.json</Button>{' '}
      <Button onClick={this.onMachineUsage.bind(this)}>Get machine_usage.json</Button>{' '}
    </Panel>
    <pre className="pre">{this.state.log}</pre>
    </div>
  }
}
