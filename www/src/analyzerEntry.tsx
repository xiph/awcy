import * as React from "react";
import * as ReactDOM from "react-dom";

import { AnalyzerComponent } from "./components/Analyzer";
import { forEachUrlParameter, getUrlParameters } from "./stores/Stores";

let parameters = getUrlParameters();
let decoder = parameters.decoder;
let file = parameters.file;

ReactDOM.render(
  <AnalyzerComponent decoderUrl={decoder} videoUrl={file}/>,
  document.getElementById("analyzer-app")
);