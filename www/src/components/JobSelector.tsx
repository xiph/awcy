import * as React from "react";
import { appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile } from "../stores/Stores";
import { Option, arraysEqual } from "./Widgets";
declare var require: any;
let Select = require('react-select');

interface JobSelectorProps {
  jobs: Job [];
  video: string;
  metric: string;
  onChange?: (metric?: string, video?: string) => void;
}

export class JobSelectorComponent extends React.Component<JobSelectorProps, {
  video: Option;
  videos: Option[];
  metric: Option;
  metrics: Option[];
}> {
  constructor() {
    super();
    this.state = {
      video: null,
      metric: null,
      metrics: metricNames.map(name => {
        return { value: name, label: name };
      }),
      videos: []
    };
  }
  componentWillReceiveProps(nextProps: JobSelectorProps, nextContext: any) {
    if (!arraysEqual(this.props.jobs, nextProps.jobs)) {
      this.resetJobs(nextProps.jobs.slice(0));
    }
  }
  resetJobs(jobs: Job []) {
    let videos = [];
    if (jobs[0].codec == 'av2-as') {
      videos = Object.keys(jobs[0].report).reduce((acc, name) => {
        return acc.concat([ { value: name, label: name },
          { value: name + ' - Convex Hull', label: name + ' - Convex Hull' }
        ]);
      }, []).filter(video => {
        if (jobs[0].codec == 'av2-as') {
            return video.value.includes("3840x2160");
        } else {
          return true;
        }
      });
    } else {
      videos = Object.keys(jobs[0].report).map(name => {
        return { value: name, label: name };
      }).filter(video => {
        if (jobs[0].codec == 'av2-as') {
          return video.value.includes("3840x2160");
        } else {
          return true;
        }
      });
    }
    videos.unshift({ value: "All", label: "All" });
    this.setState({videos} as any);
  }
  componentWillMount() {
    this.resetJobs(this.props.jobs.slice(0));
    let metric = { value: this.props.metric, label: this.props.metric };
    let video = { value: this.props.video, label: this.props.video };
    this.setState({metric, video} as any);
  }
  onChange() {
    if (!this.props.onChange) {
      return;
    }
    this.props.onChange(
      this.state.metric.value,
      this.state.video.value
    );
  }
  onChangeMetrics(metric) {
    this.setState({metric} as any, () => {
      this.onChange();
    });
  }
  onChangeVideos(video) {
    this.setState({video} as any, () => {
      this.onChange();
    });
  }
  render() {
    console.debug("Rendering Job Selector");
    return <div>
      <div className="row">
        <div className="col-xs-12">
          <div className="row">
            <div className="col-xs-6">
              <div className="selectTitle">Metric</div>
              <Select ref="metricSelect" autofocus value={this.state.metric} options={this.state.metrics} onChange={this.onChangeMetrics.bind(this)} clearable={false}/>
            </div>
            <div className="col-xs-6">
              <div className="selectTitle">Video</div>
              <Select ref="videoSelect" value={this.state.video} options={this.state.videos} onChange={this.onChangeVideos.bind(this)} clearable={false}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  }
}
