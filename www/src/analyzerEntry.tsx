import * as React from "react";
import * as ReactDOM from "react-dom";

import { AnalyzerViewCompareComponent, AnalyzerBenchmarkComponent, LocalAnalyzerComponent } from "./components/Analyzer";
import { forEachUrlParameter, getUrlParameters } from "./stores/Stores";

let parameters = getUrlParameters();
let decoder = parameters.decoder;
let file = parameters.file;
let playbackFrameRate = parameters.playbackFrameRate;
let layers = parameters.layers;
let maxFrames = parameters.maxFrames;
let benchmark = parameters.benchmark;
let local = parameters.local;
let filePrefix = parameters.filePrefix || "";


/**
 * Extracts decoder / file pairs from the url parameter string.
 */
function getDecoderVideoUrls(): {decoderUrl: string, videoUrl: string} [] {
  let currenDecoder = null;
  let pairs = [];
  forEachUrlParameter((key, value) => {
    if (key == "decoder") {
      currenDecoder = value;
    } else if (key == "file") {
      pairs.push({decoderUrl: currenDecoder, videoUrl: filePrefix + value});
    }
  });
  return pairs;
}

let pairs = getDecoderVideoUrls();

if (parameters.benchmark) {
  ReactDOM.render(
    <AnalyzerBenchmarkComponent
      decoderVideoUrlPairs={pairs}
      maxFrames={maxFrames}/>,
    document.getElementById("analyzer-app")
  );
} else if (local) {
  ReactDOM.render(
    <LocalAnalyzerComponent/>,
    document.getElementById("analyzer-app")
  );
} else {
  ReactDOM.render(
    <AnalyzerViewCompareComponent
      decoderVideoUrlPairs={pairs}
      playbackFrameRate={playbackFrameRate}
      layers={layers}
      maxFrames={maxFrames}/>,
    document.getElementById("analyzer-app")
  );
}