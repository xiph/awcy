function load_timelines() {
  $.getJSON('/time_series.json',function(data) {
    var options = {
      xaxis: {
        mode: "time"
      },
      series: {
        points: {
          show: "true"
        },
        lines: {
          show: "true"
        }
      },
      grid: {
        markings: [ { yaxis: { from: 32.77278, to: 32.77278}, color: "#ff0000"},
                    { yaxis: { from: 30.28112, to: 30.28112}, color: "#0000ff"},
                    { yaxis: { from: 31.00884, to: 31.00884}, color: "#00ff00"} ]
      },
      yaxis: {
        min: 29.5,
        max: 33
      }
    };
    $.plot('#psnr_graph',[data[0].sort()],options);
    
    options.grid.markings = [ { yaxis: { from: 33.26436, to: 33.26436}, color: "#ff0000"}, { yaxis: { from: 29.63794, to: 29.63794}, color: "#0000ff"}, { yaxis: { from: 30.78366, to: 30.78366}, color: "#00ff00"}, ]
    options.yaxis.min = 29;
    options.yaxis.max = 34;
    $.plot('#psnrhvs_graph',[data[1].sort()],options);
    
    options.grid.markings = [ { yaxis: { from: 12.05351, to: 12.05351}, color: "#ff0000"}, { yaxis: { from: 9.42931, to: 9.42931}, color: "#0000ff"}, { yaxis: { from: 11.08578, to: 11.08578}, color: "#00ff00"}, ]
    options.yaxis.min = 9;
    options.yaxis.max = 13;
    $.plot('#ssim_graph',[data[2].sort()],options);
    
    options.grid.markings = [ { yaxis: { from: 14.71761, to: 14.71761}, color: "#ff0000"}, { yaxis: { from: 11.56938, to: 11.56938}, color: "#0000ff"}, { yaxis: { from: 14.39529, to: 14.39529}, color: "#00ff00"}] 
    options.yaxis.min = 11;
    options.yaxis.max = 15;
    $.plot('#fastssim_graph',[data[3].sort()],options);
  });
}
