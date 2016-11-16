import * as React from "react";
import * as ReactDOM from "react-dom";

import { AnalyzerComponent } from "./components/Analyzer";
import { forEachUrlParameter, getUrlParameters } from "./stores/Stores";

let parameters = getUrlParameters();
let decoder = parameters.decoder;
let frames = parameters.frames === undefined ? -1 : +parameters.frames;
let file = parameters.file;

ReactDOM.render(
  <AnalyzerComponent frames={frames} decoderUrl={decoder} videoUrl={file}/>,
  document.getElementById("analyzer-app")
);