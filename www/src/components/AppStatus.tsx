import * as React from "react";
import { Table, Panel } from "react-bootstrap";
import { shallowEquals, appStore, Job, Jobs, timeSince, secondsSince, daysSince, JobStatus} from "../stores/Stores";
import { JobComponent } from "./Job";
import { JobLogComponent } from "./JobLog";

export class RefreshComponent extends React.Component<void, void> {
  timer: any = null
  componentDidMount() {
    this.timer = setInterval(() => {
      this.forceUpdate();
    });
  }
  componentWillUnmount() {
    clearInterval(this.timer);
  }
  render() {
    return <Panel>Last updated: {secondsSince(appStore.lastPoll)} seconds ago.</Panel>;
  }
}
export class AppStatusComponent extends React.Component<void, {
    aws: any;
  }> {
  constructor() {
    super();
    this.state = {} as any;
  }
  componentDidMount() {
    appStore.onAWSChange.attach(() => {
      this.setState({
        aws: appStore.aws
      } as any);
    });
  }
  render() {
    let table = null;
    let status = "";
    if (this.state.aws) {
      let autoScalingInstances = this.state.aws.AutoScalingInstances;
      if (autoScalingInstances) {
        let rows = autoScalingInstances.map(instance => [
          <tr>
            <td className="tableStringValue">{instance.InstanceId}</td>
            <td className="tableStringValue">{instance.HealthStatus}</td>
            <td className="tableStringValue">{instance.LifecycleState}</td>
          </tr>
        ]);
        table = <Table striped bordered condensed hover style={{width: "100%"}}>
          <thead>
            <tr>
              <th className="tableHeader">ID</th>
              <th className="tableHeader">Health Status</th>
              <th className="tableHeader">Lifecycle State</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </Table>
      }
      let autoScalingGroups = this.state.aws.AutoScalingGroups;
      if (autoScalingGroups) {
        var group = autoScalingGroups[0];
        var desired = group.DesiredCapacity;
        var actual = group.Instances.length;
        if (desired > 0) {
          status = `(${actual} of ${desired} machines have started.)`;
        } else {
          status = "(All machines are currently offline.)";
        }
      }
    }
    return <div>
      <RefreshComponent/>
      <Panel header={"AWS Status " + status}>
        {table}
      </Panel>
    </div>
  }
}
