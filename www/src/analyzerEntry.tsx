import * as React from "react";
import * as ReactDOM from "react-dom";

import { AnalyzerViewCompareComponent, LocalAnalyzerComponent } from "./components/analyzer/Analyzer";
import { forEachUrlParameter, getUrlParameters } from "./stores/Stores";

let parameters = getUrlParameters();
let decoder = parameters.decoder;
let file = parameters.file;
let playbackFrameRate = parameters.playbackFrameRate | 0;
let layers = parameters.layers;
let maxFrames = parameters.maxFrames;
let filePrefix = parameters.filePrefix || "";
let local = parameters.local | 0;
let blind = parameters.blind | 0;
let benchmark = parameters.benchmark | 0;

/**
 * Extracts decoder / file pairs from the url parameter string.
 */
function getDecoderVideoUrls(): {decoderUrl: string, videoUrl: string, decoderName: string} [] {
  let currenDecoder = null;
  let currenDecoderName = null;
  let pairs = [];
  forEachUrlParameter((key, value) => {
    if (key == "decoder") {
      currenDecoder = value;
    } else if (key == "decoderName") {
      currenDecoderName = value;
    } else if (key == "file") {
      pairs.push({decoderUrl: currenDecoder, videoUrl: filePrefix + value, decoderName: currenDecoderName});
    }
  });
  return pairs;
}

let pairs = getDecoderVideoUrls();

if (local) {
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
      maxFrames={maxFrames}
      blind={blind}/>,
    document.getElementById("analyzer-app")
  );
}