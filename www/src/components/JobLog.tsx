import * as React from "react";
import { Panel } from "react-bootstrap";
import { Job } from "../stores/Stores";


export class JobLogComponent extends React.Component<{
  job: Job
}, {
    isLoading: boolean;
  }> {
  onChange: any;
  constructor() {
    super();
    this.state = { isLoading: true } as any;
    this.onChange = () => {
      this.forceUpdate();
    };
  }
  componentDidMount() {
    let job = this.props.job;
    if (job) {
      job.onLogChange.attach(this.onChange);
      job.startPollingLog();
      this.setState({isLoading: true});
      job.loadLog(true).then(() => {
        this.setState({isLoading: false});
      });
    }
  }
  componentWillUnmount() {
    let job = this.props.job;
    job.onLogChange.detach(this.onChange);
  }
  render() {
    let job = this.props.job;
    if (this.state.isLoading) {
      return <Panel><span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Loading log ...</Panel>
    }
    return <pre className="log">{job.log}</pre>;
  }
}