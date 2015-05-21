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
      },
      yaxis: {
        min: 29.5,
        max: 33
      }
    };
    $.plot('#psnr_graph',[data[0].sort()],options);
    
    options.yaxis.min = 29;
    options.yaxis.max = 34;
    $.plot('#psnrhvs_graph',[data[1].sort()],options);
    
    options.yaxis.min = 9;
    options.yaxis.max = 13;
    $.plot('#ssim_graph',[data[2].sort()],options);
    
    options.yaxis.min = 11;
    options.yaxis.max = 15;
    $.plot('#fastssim_graph',[data[3].sort()],options);
  });
}
