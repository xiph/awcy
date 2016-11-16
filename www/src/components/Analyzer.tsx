import * as React from "react";
import { Button, Panel, Form, FormGroup, ControlLabel, FormControl, ButtonToolbar } from "react-bootstrap";
import { } from "react-bootstrap";
import { appStore, AppDispatcher, Jobs, Job, metricNames, AnalyzeFile } from "../stores/Stores";
import { Analyzer } from "../analyzer";
import { Promise } from "es6-promise";

import { BarPlot, BarPlotTable, Data } from "./Plot";
declare var d3;

const DEFAULT_MARGIN = { top: 10, right: 10, bottom: 20, left: 40 };

export class AnalyzerComponent extends React.Component<{
  decoderUrl: string;
  videoUrl: string;
  frames: number;
}, {
    analyzer: Analyzer.Analyzer;
    analyzerFailedToLoad: boolean | null
    decoding: boolean;
  }> {
  bitsSvg: SVGElement;
  symbolsSvg: SVGElement;
  blockSizeSvg: SVGElement;
  predictionModeSvg: SVGElement;
  constructor() {
    super();
    this.state = {
      analyzer: null,
      analyzerFailedToLoad: null,
      decoding: false
    };
  }
  componentWillMount() {
    this.load(this.props.decoderUrl, this.props.videoUrl);
  }
  load(decoderPath: string, videoPath: string) {
    Analyzer.Analyzer.loadDecoder(decoderPath).then((analyzer) => {
      console.info(analyzer);
      Analyzer.Analyzer.downloadFile(videoPath).then((bytes) => {
        analyzer.openFileBytes(bytes);
        this.setState({ analyzer, analyzerFailedToLoad: false } as any);
        this.decode(this.props.frames);
      }).catch(() => {
        this.setState({ analyzerFailedToLoad: true } as any);
      });
    }).catch(() => {
      this.setState({ analyzerFailedToLoad: true } as any);
    });
  }
  decode(frames: number) {
    let analyzer = this.state.analyzer;
    this.decodeFrames(frames, () => {
      this.renderBitsChart();
      this.renderSymbolsChart();
      this.renderBlockSizes(this.blockSizeSvg, analyzer.frames.map(x => x.blockSizeHistogram));
      this.renderPredictionModes(this.predictionModeSvg, analyzer.frames.map(x => x.predictionModeHistogram));
    });
  }
  decodeFrames(count: number, next: any) {
    let analyzer = this.state.analyzer;
    if (count == 0) {
      next();
      return;
    }
    this.setState({ decoding: true } as any);
    let interval = setInterval(() => {
      analyzer.readFrame().then((frame) => {
        this.forceUpdate();
        if (!frame || (count > 0 && analyzer.frames.length >= count)) {
          clearInterval(interval);
          this.setState({ decoding: false } as any);
          next();
          return;
        }
      });
    }, 16);
  }
  renderChart(element: SVGElement, tooltipKind: "percent" | "value", names: string[], data: any[], yDomain = [0, 1]) {
    let legendWidth = 128;
    var svg = d3.select(element),
      margin = DEFAULT_MARGIN,
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom,
      g = svg.append("g").attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

    var x = d3.scaleBand()
      .rangeRound([0, width - legendWidth])
      .padding(0.1)
      .align(0.1);
    var y = d3.scaleLinear().rangeRound([height, 0]);
    var z = d3.scaleOrdinal(d3.schemeCategory20);

    var stack = d3.stack();

    x.domain(data.map((d, i) => i));
    x.domain(d3.range(data.length));
    y.domain(yDomain).nice();
    z.domain(names.length);

    g.selectAll(".serie")
      .data(stack.keys(names)(data))
      .enter().append("g")
      .attr("class", "serie")
      .attr("fill", function (d) {
        return z(d.key);
      })
      .selectAll("rect")
      .data(function (d) {
        return d;
      })
      .enter().append("rect")
      .attr("x", function (d, i) {
        return x(i);
      })
      .attr("y", function (d) {
        return y(d[1]);
      })
      .attr("height", function (d) {
        return y(d[0]) - y(d[1]);
      })
      .attr("width", x.bandwidth())
      .on("mouseover", function() { tooltip.style("display", null); })
      .on("mouseout", function() { tooltip.style("display", "none"); })
      .on("mousemove", function(d) {
        var xPosition = d3.mouse(this)[0] + 25;
        var yPosition = d3.mouse(this)[1] - 25;
        tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");
        // let text = d.key + ": " + ((d[1] - d[0]) * 100).toFixed(2) + "%";
        let text = "";
        if (tooltipKind == "percent") {
          text = ((d[1] - d[0]) * 100).toFixed(2) + "%";
        } else {
          text = ((d[1] - d[0])).toFixed(2);
        }
        tooltip.select("text").text(text);
      });

    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y).ticks(5, "s"))
      .append("text")
      // .attr("x", 2)
      // .attr("y", y(y.ticks(5).pop()))
      // .attr("dy", "0.35em")
      // .attr("text-anchor", "start")
      // .attr("fill", "#000")
      // .text("");

    let tickValues = d3.range(data.length);
    if (tickValues.length > 60) {
      tickValues = tickValues.map(x => 4 * x);
      tickValues = tickValues.filter(x => x < data.length);
    }

    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0, " + height + ")")
      .call(d3.axisBottom(x).tickValues(tickValues));

    var legend = g.selectAll(".legend")
      .data(names)
      .enter().append("g")
      .attr("class", "legend")
      .attr("transform", function (d, i) { return `translate(${width - legendWidth}, ${i * 16})`; })
      .style("font", "10px sans-serif");

    legend.append("rect")
      .attr("x", 0)
      .attr("y", 2)
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", z);

    legend.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .attr("dy", ".35em")
      .attr("text-anchor", "start")
      .text(function (d) { return d; });

    // Prep the tooltip bits, initial display is hidden
    var tooltip = svg.append("g")
      .attr("class", "d3Tooltip")
      .style("display", "none");

    // tooltip.append("rect")
    //   .attr("width", 30)
    //   .attr("height", 20)
    //   .attr("fill", "white")
    //   .style("opacity", 0.5);

    tooltip.append("text")
      .attr("x", 15)
      .attr("dy", "1.2em")
      .style("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "bold");
  }
  renderBlockSizes<T>(element: SVGElement, histograms: Analyzer.Histogram<T>[]) {
    let names = [];
    for (let i = 0; i < Analyzer.BlockSize.LAST; i++) {
      names.push(Analyzer.BlockSize[i]);
    }
    let rows = [];
    histograms.forEach((histogram: Analyzer.Histogram<T>, i) => {
      let row = { frame: i, total: 0 };
      let total = 0;
      names.forEach((name, i) => {
        total += histogram.counts[i];
      });
      names.forEach((name, i) => {
        row[name] = histogram.counts[i] / total;
      });
      rows.push(row);
    });
    this.renderChart(element, "percent", names, rows);
    return;
  }
  renderPredictionModes<T>(element: SVGElement, histograms: Analyzer.Histogram<T>[]) {
    let names = [];
    for (let i = 0; i < Analyzer.PredictionMode.LAST; i++) {
      names.push(Analyzer.PredictionMode[i]);
    }
    let rows = [];
    histograms.forEach((histogram: Analyzer.Histogram<T>, i) => {
      let row = { frame: i, total: 0 };
      let total = 0;
      names.forEach((name, i) => {
        total += histogram.counts[i]
      });
      names.forEach((name, i) => {
        row[name] = histogram.counts[i] / total;
      });
      rows.push(row);
    });
    this.renderChart(element, "percent", names, rows);
    return;
  }
  renderBitsChart() {
    console.debug("Rendering Chart");
    let data = [];
    let analyzer = this.state.analyzer;
    let names = Analyzer.Accounting.getSortedSymbolNames(analyzer.frames.map(frame => frame.accounting));
    let max = 0;
    analyzer.frames.forEach((frame, i) => {
      let row = { frame: i, Bits: 0 };
      let symbols = frame.accounting.createFrameSymbols();
      let total = 0;
      names.forEach(name => {
        let symbol = symbols[name];
        let bits = symbol ? symbol.bits : 0;
        total += bits;
      });
      total >>= 3;
      row.Bits = total;
      max = Math.max(max, total);
      data.push(row);
    });
    this.renderChart(this.bitsSvg, "value", ["Bits"], data, [0, max]);
  }
  renderSymbolsChart() {
    console.debug("Rendering Chart");

    let data = [];
    let analyzer = this.state.analyzer;
    let names = Analyzer.Accounting.getSortedSymbolNames(analyzer.frames.map(frame => frame.accounting));

    analyzer.frames.forEach((frame, i) => {
      let row = { frame: i, total: 0 };
      let symbols = frame.accounting.createFrameSymbols();
      let total = 0;
      names.forEach(name => {
        let symbol = symbols[name];
        let bits = symbol ? symbol.bits : 0;
        total += bits;
      });

      names.forEach(name => {
        let symbol = symbols[name];
        let bits = symbol ? symbol.bits : 0;
        row[name] = bits / total;
      });

      data.push(row);
    });

    this.renderChart(this.symbolsSvg, "percent", names, data);
  }
  render() {
    console.debug("Rendering Analyzer");
    let analyzer = this.state.analyzer;
    let analyzerHeader = `Analyzer Report: ${this.props.videoUrl}`;
    if (!analyzer) {
      return <Panel header={analyzerHeader}>
        {this.state.analyzerFailedToLoad ?
          <span><span className="glyphicon glyphicon-warning-sign"></span> Analyzer failed to load. </span> :
          <span><span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Loading analyzer ... </span>
        }
      </Panel>
    }

    let decoding = this.state.decoding;
    if (decoding) {
      return <Panel header={analyzerHeader}>
        <span><span className="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span> Decoding frame {analyzer.frames.length}...</span>
      </Panel>
    }

    return <Panel header={analyzerHeader}>
      <h5>Bits per frame</h5>
      <svg ref={(self: any) => this.bitsSvg = self} width="1200" height="100"></svg>
      <h5>% of bits used to encode symbols per frame</h5>
      <svg ref={(self: any) => this.symbolsSvg = self} width="1200" height="300"></svg>
      <h5>% of pixels covered by block size per frame</h5>
      <svg ref={(self: any) => this.blockSizeSvg = self} width="1200" height="300"></svg>
      <h5>% of pixels predicted by mode per frame</h5>
      <svg ref={(self: any) => this.predictionModeSvg = self} width="1200" height="300"></svg>
    </Panel>
  }
}