var wd;

function load_timelines() {
  load_timelines_watermark();
}

function load_timelines_watermark() {
  $.getJSON('/watermark.json', function(data) {
    wd = data;
    load_time_series();
  });
}

function load_time_series() {
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
        markings: [ { yaxis: { from: wd.x265.psnr, to: wd.x265.psnr}, color: "#ff0000"},
                    { yaxis: { from: wd.x264.psnr, to: wd.x264.psnr}, color: "#00ff00"} ]
      },
      yaxis: {
        min: 29.5,
        max: 40
      }
    };
    $.plot('#psnr_graph',[data[0].sort()],options);
    
    options.grid.markings = [ { yaxis: { from: wd.x265.psnrhvs, to: wd.x265.psnrhvs}, color: "#ff0000"},
                              { yaxis: { from: wd.x264.psnrhvs, to: wd.x264.psnrhvs}, color: "#00ff00"} ];
    options.yaxis.min = 29;
    options.yaxis.max = 45;
    $.plot('#psnrhvs_graph',[data[1].sort()],options);
    
    options.grid.markings = [ { yaxis: { from: wd.x265.ssim, to: wd.x265.ssim}, color: "#ff0000"},
                              { yaxis: { from: wd.x264.ssim, to: wd.x264.ssim}, color: "#00ff00"} ];
    options.yaxis.min = 9;
    options.yaxis.max = 20;
    $.plot('#ssim_graph',[data[2].sort()],options);
    
    options.grid.markings = [ { yaxis: { from: wd.x265.fastssim, to: wd.x265.fastssim}, color: "#ff0000"},
                              { yaxis: { from: wd.x264.fastssim, to: wd.x264.fastssim}, color: "#00ff00"} ];
    options.yaxis.min = 8;
    options.yaxis.max = 30;
    $.plot('#fastssim_graph',[data[3].sort()],options);
  });
}
