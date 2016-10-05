import * as React from "react";
import { Button } from "react-bootstrap";
import { ProgressBar } from "react-bootstrap";
import { ListGroup, ListGroupItem } from "react-bootstrap";
import { Navbar, Nav, NavItem, NavDropdown, MenuItem } from "react-bootstrap";
import { Col, Row } from "react-bootstrap";
import { Panel } from "react-bootstrap";
import { Tabs, Tab } from "react-bootstrap";

import { FullReportComponent } from "./components/FullReport"
import { JobListComponent } from "./components/Jobs"
import { JobLogComponent, AppStatusComponent } from "./components/Log"

import { AppStore, Job, JobStatus, SelectJob, AppDispatcher } from "./stores/Stores"

import { AnalyzerComponent, ShareComponent, LoginComponent } from "./components/Widgets"

export interface AppProps { }
export interface AppState { }

export class Lots extends React.Component<void, void> {
  render() {
    let a = [];
    for (let i = 0; i < 1000; i++) {
      a.push(<p key={i}>{i}</p>)
    }
    return <div>{a}</div>;
  }
}

export class App extends React.Component<AppProps, AppState> {
  store: AppStore;
  constructor() {
    super();
    this.store = new AppStore();

    this.store.onChange.attach(() => {
      this.forceUpdate();
    });

    this.store.onAnalyzedFilesChanged.attach(() => {
      this.forceUpdate();
    });
  }

  componentDidMount() {
    this.store.load();
  }

  render() {
    let analyzerTabs = this.store.analyzedFiles.map((o, i) => {
      return <Tab eventKey={5 + i} key={o.decoderUrl + o.videoUrl + i} title={"Analyzer: " + o.videoUrl}>
        <div style={{ padding: 10, height: window.innerHeight, overflow: "scroll" }}>
          <AnalyzerComponent decoderUrl={o.decoderUrl} videoUrl={o.videoUrl}/>
        </div>
      </Tab>
    });
    console.debug("Rendering App");
    return <div>
      <div className="sidebar">
        <Tabs defaultActiveKey={1} animation={false} id="noanim-tab-example">
          <Tab eventKey={1} key="runs" title="Runs">
            <div style={{ padding: 10 }}>
              <JobListComponent store={this.store} jobStatusFilter={JobStatus.All} jobs={this.store.jobs} listHeight={window.innerHeight - 200} />
            </div>
          </Tab>
          <Tab eventKey={2} key="share" title="Share">
            <div style={{ padding: 10 }}>
              <ShareComponent store={this.store} />
            </div>
          </Tab>
          <Tab eventKey={3} key="login" title="Login">
            <div style={{ padding: 10 }}>
              <LoginComponent store={this.store}/>
            </div>
          </Tab>
        </Tabs>
      </div>
      <div className="content">
        <Tabs defaultActiveKey={3} animation={false} id="noanim-tab-example">
          <Tab eventKey={3} key="graphs" title="Report">
            <div style={{ padding: 10, height: window.innerHeight, overflow: "scroll" }}>
              <FullReportComponent jobs={this.store.selectedJobs} />
            </div>
          </Tab>
          <Tab eventKey={4} key="status" title="Status">
            <div style={{ padding: 10, height: window.innerHeight, overflow: "scroll" }}>
              <AppStatusComponent store={this.store} />
            </div>
          </Tab>
          {analyzerTabs}
        </Tabs>
      </div>
    </div>
  }
}