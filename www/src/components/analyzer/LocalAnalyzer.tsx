import * as React from "react";
import { Button } from "react-bootstrap";
import { localFiles, localFileProtocol } from "./analyzerTools";
import {AnalyzerViewCompareComponent } from "./Analyzer"

export class LocalAnalyzerComponent extends React.Component<{

}, {
    show: boolean;
    group: { decoderUrl: string, videoUrl: string, name: string, decoderName: string }[][]
  }> {
  constructor() {
    super();
    this.state = {
      show: false,
      group: [[], [], []]
    } as any;
  }
  onDrop(i, ev) {
    ev.preventDefault();
    function readFile(item) {
      return new Promise((resolve, reject) => {
        if (item.kind == "file") {
          let file = item.getAsFile();
          let localName = i + "_" + file.name;
          console.log("Loading: " + file.name);
          let reader = new FileReader();
          reader.onload = function () {
            let result;
            if (typeof reader.result == "string") {
              result = reader.result;
            } else {
              result = new Uint8Array(reader.result);
            }
            localFiles[localName] = result;
          };
          if (file.type === "text/javascript") {
            reader.readAsText(file);
          } else {
            reader.readAsArrayBuffer(file);
          }
          resolve({
            name: file.name,
            localName: localName,
            type: file.type || "video/ivf"
          });
        } else {
          reject();
        }
      });
    }
    var dt = ev.dataTransfer;
    if (dt.items) {
      let currenDecoder = null;
      let items = [];
      for (let i = 0; i < dt.items.length; i++) {
        items.push(dt.items[i]);
      }
      let group = this.state.group;
      group[i] = [];
      Promise.all(items.map(item => readFile(item))).then(files => {
        let decoder = files.find((file: any) => file.type == "text/javascript") as any;
        if (!decoder) {
          alert("Drag at least one decoder.js file.");
          return;
        }
        files.forEach((file: any) => {
          if (file.type == "text/javascript") {
            return;
          }
          group[i].push({
            decoderUrl: localFileProtocol + decoder.localName,
            videoUrl: localFileProtocol + file.localName,
            name: "(" + file.name + ", " + decoder.name + ")",
            decoderName: ""
          });
        });
        if (group[i].length == 0) {
          alert("Drag at least one .ivf file.");
          return;
        }
        this.setState({ group } as any);
      });
    } else {
      throw new Error("Can't read files.");
    }
  }
  onDragOver(ev) {
    ev.preventDefault();
  }
  onDragEnd() {
    console.info("drag end");
  }
  analyze() {
    this.setState({ show: true } as any);
  }
  render() {
    let group = this.state.group;
    let pairs = group[0].concat(group[1]).concat(group[2]);
    if (this.state.show) {
      return <AnalyzerViewCompareComponent
        decoderVideoUrlPairs={pairs}
        />
    }
    return <div className="panel">
      <div style={{ float: "left" }} className="dropPanel" onDrop={this.onDrop.bind(this, 0)} onDragOver={this.onDragOver.bind(this)} onDragEnd={this.onDragEnd.bind(this)}>
        {
          group[0].length ?
            group[0].map(pair => pair.name).join(", ")
            : <strong>Drag and drop a decoder and one or more video files ...</strong>
        }
      </div>
      <div style={{ float: "left" }} className="dropPanel" onDrop={this.onDrop.bind(this, 1)} onDragOver={this.onDragOver.bind(this)} onDragEnd={this.onDragEnd.bind(this)}>
        {
          group[1].length ?
            group[1].map(pair => pair.name).join(", ")
            : <strong>Drag and drop a decoder and one or more video files ...</strong>
        }
      </div>
      <div style={{ float: "left" }} className="dropPanel" onDrop={this.onDrop.bind(this, 2)} onDragOver={this.onDragOver.bind(this)} onDragEnd={this.onDragEnd.bind(this)}>
        {
          group[2].length ?
            group[2].map(pair => pair.name).join(", ")
            : <strong>Drag and drop a decoder and one or more video files ...</strong>
        }
      </div>
      <div style={{ clear: "left", paddingTop: "8px" }}>
        <Button onClick={this.analyze.bind(this)} disabled={pairs.length == 0} >Analyze</Button>
      </div>
    </div>
  }
}
