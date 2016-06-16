function rdgraph_draw(selected_graphs, outfile, set) {
  //get output data
  var graph_requests = [];
  for (var i in selected_graphs) {
    graph_requests.push($.get('/runs/'+selected_graphs[i]+'/'+outfile));
  }

  var bpp_mode = $("#graph_x_scaler").val();
  var metric_index = parseInt($('#metric').val());
  var logarithmic = $('#logarithmic').prop('checked');

  // draw chart
  $.when.apply($,graph_requests).done(function() {
    if (selected_graphs.length == 1) {
      var argument_list = [ arguments ];
    } else {
      var argument_list = arguments;
    }

    var curves = [];

    for (var j in argument_list) {
      var curve = [];
      var data = argument_list[j][0];
      var lines = data.split('\n');
      for (var i in lines) {
        var line = lines[i].split(' ');
        //line[0-6] --> quantizer, pixels, bytes, PSNR, PSNR-HVS, SSim, FastSSim
        var bpp_scaler = 1;
        if (bpp_mode == 'mbps') {
          bpp_scaler = set.width * set.height * set.framerate / 1000000;
        }
        var point = [bpp_scaler * line[2]*8 / line[1], line[3+metric_index]];
        curve.push(point);
      }
      var series = {
        data: curve,
        points: { show: true },
        lines: { show: true },
        label: selected_graphs[j]
      };
      curves.push(series);
    }

    var options = {
      xaxis: {
        axisLabel: 'Bits per Pixel',
      },
      yaxis: {
        axisLabel: 'Picture quality (dB)'
      },
      legend: {
        show: true,
        position: 'se'
      },
      series: {
        lines: {
          lineWidth: 1
        },
        shadowSize: 0
      },
      zoom: {
        interactive: true
      },
      pan: {
        interactive: true
      },
      crosshair: {
        mode: 'y'
      },
      grid: {
        hoverable: true
        /*
        markings: [
          { xaxis: { from: 0.005*bpp_scaler, to: 0.02*bpp_scaler }, color: "#fff0f0" },
          { xaxis: { from: 0.02*bpp_scaler, to: 0.06*bpp_scaler }, color: "#f0fff0" },
          { xaxis: { from: 0.06*bpp_scaler, to: 0.2*bpp_scaler }, color: "#f0f0ff" }
        ]
        */
      }
    };

/*
    var x_max = parseFloat($("#graph_x_range").val());
    options.xaxis.max = x_max * bpp_scaler;
    options.xaxis.min = 0.003;
*/
    if (bpp_scaler != 1) {
      options.xaxis.axisLabel = 'Mbps';
    }

    if (logarithmic) {
      options.xaxis.transform = function (v) { return Math.log(v); };
      options.xaxis.inverseTransform = function (v) { return Math.exp(v); };
    }

    $.plot('#rd_graph',curves,options);

    $("#rd_graph").bind("plothover", update_cursor);
  });
}

var cursor_pos = 0;
var cursor_in_flight = false;
function update_cursor(event, pos, item) {
  cursor_pos = pos.y;
  if (cursor_in_flight) return;
  cursor_in_flight = true;
  req = {}
  var selected_graphs = get_selected_graphs();
  if ($('#reverse_bd').is(':checked')) {
    req['a'] = selected_graphs[0];
    req['b'] = selected_graphs[1];
    } else {
    req['a'] = selected_graphs[1];
    req['b'] = selected_graphs[0];
  }
  req['metric_score'] = pos.y;
  req['method'] = 'metric-point';
  var filter_task = $('#run_filter_task').val();
  var outfile = $("#video_name").val();
  req['set'] = filter_task;
  req['file'] = outfile;
  $.get('/bd_rate',req,function(data) {
    cursor_in_flight = false;
    var metric_index = parseInt($('#metric').val())
    var metric_value = data.split('\n')[metric_index];
    $('#hover_delta').text(metric_value);
    if (cursor_pos != pos.y) {
      update_cursor(undefined, {y: cursor_pos}, undefined);
    }
  });
}
