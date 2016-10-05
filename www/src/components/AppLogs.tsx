import * as React from "react";
import { Table, Panel } from "react-bootstrap";
import { appStore, Job, Jobs, timeSince, daysSince, JobStatus} from "../stores/Stores";
import { JobComponent } from "./Job";
import { JobLogComponent } from "./JobLog";

export class AppLogsComponent extends React.Component<void, void> {
  onChange: any;
  constructor() {
    super();
    this.onChange = () => {
      this.forceUpdate();
    };
  }
  componentWillMount() {
    appStore.jobs.onChange.attach(this.onChange);
  }
  componentWillUnmount() {
    appStore.jobs.onChange.detach(this.onChange);
  }
  render() {
    console.debug("Rendering Logs");
    let logs = [];
    let jobs = appStore.jobs.getSelectedJobs();
    jobs.forEach(job => {
      logs.push(<div key={job.id}>
        <JobComponent detailed job={job}/>
        <JobLogComponent job={job} />
      </div>);
    });
    if (logs.length == 0) {
      logs.push(<div key="noruns">
        No runs selected.
      </div>);
    }
    return <Panel>
      {logs}
    </Panel>
  }
}
