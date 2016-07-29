'use strict';

var express = require('express');
var path = require('path');
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var fs = require('fs-extra');
var path = require('path');
var cp = require('child_process');
var irc = require('irc');
var AWS = require('aws-sdk');
var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser())

var config = require('./config.json');

var channel = config.channel;

var ircclient = new irc.Client('irc.freenode.net', 'XiphAWCY', {
    channels: [channel],
});
ircclient.addListener('error', function(message) {
    console.log('error: ', message);
});

var key = fs.readFileSync('secret_key', {encoding: 'utf8'}).trim();

var last_job_completed_time = Date.now();

function check_key(req,res,next) {
  if (req.cookies.key == key) {
    next();
    return;
  } else if (key == req.body.key) {
    next();
    return;
  } else {
    res.status(403).send('Key verification failed.\n');
    return;
  }
};

var binaries = {
  'daala':['examples/encoder_example'],
  'x264': ['x264'],
  'x265': ['build/linux/x265'],
  'vp8': ['vpxenc','vpxdec'],
  'vp9': ['vpxenc','vpxdec'],
  'vp10': ['vpxenc','vpxdec'],
  'vp10-rt': ['vpxenc','vpxdec'],
  'av1': ['aomenc','aomdec'],
  'av1-rt': ['aomenc','aomdec'],
  'thor': ['build/Thorenc','build/Thordec']
};

/* The build queue. Only one job can be built at a time. */

var build_job;
var build_job_queue = [];
var run_job;
var run_job_queue = [];
var run_job_in_progress = false
var build_job_in_progress = false;
var build_job_child_process = null;
var run_job_child_process = null;
var last_build_job_completed_time = Date.now();

function process_build_queue() {
  cp.exec('node generate_list.js');
  if (build_job_in_progress) { return; };
  if (build_job_queue.length > 0) {
    build_job_in_progress = true;
    build_job = build_job_queue.shift();
    console.log('Starting build_job '+build_job.run_id);
    ircclient.say(channel,build_job.nick+': Starting '+build_job.run_id);
    var env = process.env;
    env['LANG'] = 'en_US.UTF-8';
    env['CODEC'] = build_job.codec;
    env['EXTRA_OPTIONS'] = build_job.extra_options;
    env['BUILD_OPTIONS'] = build_job.build_options;
    env['RUN_ID'] = build_job.run_id;
    if (build_job.ab_compare) {
      env['AB_COMPARE'] = '1';
    }
    if (build_job.qualities) {
      env['QUALITIES'] = build_job.qualities;
    } else {
      env['QUALITIES'] = '';
    }
    build_job_child_process = cp.spawn('./create_test_branch.sh',
      [build_job.commit, build_job.run_id, build_job.codec],
      { env: env });
    var job_log = ''
    build_job_child_process.stdout.on('data', function(data) {
      console.log(data.toString());
      fs.appendFile('runs/'+build_job.run_id+'/output.txt',data);
    });
    build_job_child_process.stderr.on('data', function(data) {
      console.log(data.toString());
      fs.appendFile('runs/'+build_job.run_id+'/output.txt',data);
    });
    build_job_child_process.on('close', function(error) {
      for (var binary of binaries[build_job.codec]) {
        fs.mkdirsSync('runs/'+build_job.run_id+'/x86_64/'+path.dirname(binary));
        fs.copySync(build_job.codec+'/'+binary,'runs/'+build_job.run_id+'/x86_64/'+binary);
      }
      if (error == 0) {
        add_to_run_queue(build_job);
      } else {
        ircclient.say(channel,build_job.nick+': Failed to build! '+build_job.run_id+
          ' https://arewecompressedyet.com/runs/'+build_job.run_id+'/output.txt');
      }
      build_job_in_progress = false;
      build_job = undefined;
      process_build_queue();
    });
  }
};

function add_to_run_queue(job) {
  run_job_queue.push(job);
  process_run_queue();
}

function process_run_queue() {
  if (run_job_in_progress) { return; };
  if (run_job_queue.length == 0) return;
  run_job_in_progress = true;
  var job = run_job_queue.shift();
  run_job = job;
  var env = process.env;
  env['LANG'] = 'en_US.UTF-8';
  env['CODEC'] = job.codec;
  env['EXTRA_OPTIONS'] = job.extra_options;
  env['BUILD_OPTIONS'] = job.build_options;
  env['RUN_ID'] = job.run_id;
  if (job.ab_compare) {
    env['AB_COMPARE'] = '1';
  }
  if (job.qualities) {
    env['QUALITIES'] = job.qualities;
  } else {
    env['QUALITIES'] = '';
  }
  run_job_child_process = cp.spawn('./run_video_test.sh',
    [job.commit,job.run_id,job.task],
    { env: env });
  var job_log = ''
  run_job_child_process.stdout.on('data', function(data) {
    fs.appendFile('runs/'+job.run_id+'/output.txt',data);
  });
  run_job_child_process.stderr.on('data', function(data) {
    fs.appendFile('runs/'+job.run_id+'/output.txt',data);
  });
  run_job_child_process.on('close', function(error) {
    if (error == 0) {
      console.log('video test succeeded');
      ircclient.say(channel,job.nick+': Finished '+job.run_id);
    } else {
      ircclient.say(channel,job.nick+': Exploded '+job.run_id+
        ' see https://arewecompressedyet.com/error.txt');
    }
    run_job = undefined;
    run_job_in_progress = false;
    last_job_completed_time = Date.now();
    if (error == 0) {
    } else {
      ircclient.say(channel,job.nick+': Exploded '+job.run_id+
        ' https://arewecompressedyet.com/runs/'+job.run_id+'/output.txt');
    }
    process_run_queue();
  });
}

app.use(express.static(__dirname + '/www'));
app.use('/runs',express.static(__dirname + '/runs'));
app.use('/sets.json',express.static(__dirname + '/rd_tool/sets.json'));
app.use('/error.txt',express.static(__dirname + '/error.txt'));
app.use('/list.json',express.static(__dirname + '/list.json'));
app.use('/ab_paths.json',express.static(__dirname + '/ab_paths.json'));
app.use('/time_series.json',express.static(__dirname + '/time_series.json'));
app.use('/watermark.json',express.static(__dirname + '/watermark.json'));

app.get('/run_list.json',function(req,res) {
  fs.readdir('runs',function(err,files) {
    res.send(files);
  });
});

app.get('/build_job_queue.json',function(req,res) {
  res.json(build_job_queue);
});

app.get('/run_job_queue.json',function(req,res) {
  res.json(run_job_queue);
});

app.get('/run_job.json',function(req,res) {
  res.json(run_job);
});

app.get('/build_job.json',function(req,res) {
  res.json(build_job);
});

let autoScalingInstances = null;
let autoScalingGroups = null;

function shutdownAmazon() {
  var autoscaling = new AWS.AutoScaling();
  autoscaling.setDesiredCapacity({
    AutoScalingGroupName: config.scaling_group,
    DesiredCapacity: 0,
    HonorCooldown: true
  }, function (err, data) {
  });
}

function pollAmazon() {
  var autoscaling = new AWS.AutoScaling();
  autoscaling.describeAutoScalingInstances({},function(err,data) {
    autoScalingInstances = data;
  });
  autoscaling.describeAutoScalingGroups({AutoScalingGroupNames: [config.scaling_group]}, function(err,data) {
    autoScalingGroups = data;
  });
  if ((!build_job_in_progress) && (build_job_queue.length == 0)) {
    var shutdown_threshold = 1000*60*30.5; // 30.5 minutes
    if ((Date.now() - last_build_job_completed_time) > shutdown_threshold) {
      console.log("Shutting down all Amazon instances because idle.");
      shutdownAmazon();
    }
  }
}

if (config.have_aws) {
  setInterval(pollAmazon, 60*1*1000);
}

app.get('/describeAutoScalingGroups',function(req,res) {
  res.send(autoScalingGroups);
});

app.get('/describeAutoScalingInstances',function(req,res) {
  res.send(autoScalingInstances);
});

app.get('/bd_rate',function(req,res) {
  var a = path.basename(req.query['a']);
  var b = path.basename(req.query['b']);
  var min_bpp = req.query['min_bpp'];
  var max_bpp = req.query['max_bpp'];
  var metric_score = req.query['metric_score'];
  var file = path.basename(req.query['file']);
  var set = path.basename(req.query['set']);
  var a_file = __dirname+'/runs/'+a+'/'+set+'/'+file;
  var b_file = __dirname+'/runs/'+b+'/'+set+'/'+file;
  if (req.query['method'] == 'jm') {
    cp.execFile('./bd_rate_jm.m',[a_file,b_file],
                {},
                function(error,stdout,stderr) {
      res.send(stdout);
    });
  } else if (req.query['method'] == 'report') {
    cp.execFile('./bd_rate_report.py',[__dirname+'/runs/'+a,__dirname+'/runs/'+b,'--anchordir',__dirname+'/runs/','--suffix=-daala.out'],
                {},
                function(error,stdout,stderr) {
      if (error) {
        res.send(stderr + stdout);
      } else {
        res.send(stdout);
      }
    });
  } else if (req.query['method'] == 'report-overlap') {
    cp.execFile('./bd_rate_report.py',[__dirname+'/runs/'+a,__dirname+'/runs/'+b,'--anchordir',__dirname+'/runs/','--suffix=-daala.out','--overlap'],
                {},
                function(error,stdout,stderr) {
      if (error) {
        res.send(stderr + stdout);
      } else {
        res.send(stdout);
      }
    });
  } else if (req.query['method'] == 'metric-point') {
    cp.execFile('./rate_delta_point.py',[a_file,b_file,metric_score],
                {},
                function(error,stdout,stderr) {
      if (error) {
        res.send(stderr);
      } else {
        res.send(stdout);
      }
    });
  } else {
    cp.execFile('./bd_rate.m',[a_file,b_file],
                {env: {'BUILD_ROOT': 'daalatool/', 'MIN_BPP': min_bpp, 'MAX_BPP': max_bpp}, cwd: __dirname+'/daalatool/tools/matlab/'},
                function(error,stdout,stderr) {
      res.send(stdout);
    });
  }
});

app.use('/submit',check_key);

app.post('/submit/job',function(req,res) {
  var job = {};
  var gerrit_detect_re = /I[0-9a-f].*/g;
  job.codec = 'daala';
  job.commit = req.body.commit;
  if (gerrit_detect_re.test(job.commit)) {
    res.status(400).send('Error: Commit looks like a Gerrit Change-Id. Use the commit hash instead.');
    return;
  }
  job.run_id = req.body.run_id.replace(' ','_');
  if (req.body.task) {
    if (req.body.task == 'custom') {
      job.videos = req.body.custom_videos;
    } else {
      job.task = req.body.task;
    }
  } else {
    job.task = 'ntt-short-1';
  }
  if (req.body.extra_options) {
    job.extra_options = req.body.extra_options;
  } else {
    job.extra_options = '';
  }
  if (req.body.build_options) {
    job.build_options = req.body.build_options;
  } else {
    job.build_options = '';
  }
  if (req.body.qualities) {
    job.qualities = req.body.qualities;
  }
  if (req.body.codec) {
    job.codec = req.body.codec;
  } else {
    job.codec = 'daala';
  }
  if (req.body.nick) {
    job.nick = req.body.nick;
  } else {
    job.nick = 'AWCY';
  }
  if (req.body.master) {
    job.master = req.body.master;
  }
  if (req.body.ab_compare) {
    job.ab_compare = req.body.ab_compare;
  } else {
    job.ab_compare = false;
  }
  job.task_type = 'video';
  if (job.run_id.length > 256) {
    res.status(400).send('Choose a shorter run id, silly.\n');
  }
  if (fs.existsSync('runs/'+job.run_id)) {
    res.status(400).send('ID is not unique! Choose another.\n');
    return;
  }
  fs.mkdirSync('runs/'+job.run_id);
  fs.writeFile('runs/'+job.run_id+'/info.json',JSON.stringify(job));
  build_job_queue.push(job);
  process_build_queue();
  res.send('ok');
});

app.post('/submit/delete',function(req,res) {
  var run = path.basename(req.body.run_id);
  cp.execFile('nuke_branch.sh',[run],
              function(error,stdout,stderr) {
    res.send(stderr+stdout);
  });
});

app.post('/submit/cancel',function(req,res) {
  var run = req.body.run_id;
  run_job_queue.forEach(function(job, index) {
    if (job.run_id == run) {
      run_job_queue.splice(index, 1);
    }
  });
  res.send('ok');
});

app.post('/submit/kill',function(req,res) {
  run_job_child_process.kill('SIGTERM');
  run_job_child_process.kill('SIGKILL');
  res.send(run_job_child_process.pid);
});

app.post('/submit/restart', function(req,res) {
  process.exit();
  res.send('ok');
});

app.post('/submit/setDesiredCapacity',function(req,res) {
  var autoscaling = new AWS.AutoScaling();
  autoscaling.setDesiredCapacity({
    AutoScalingGroupName: config.scaling_group,
    DesiredCapacity: req.body.DesiredCapacity,
    HonorCooldown: false
  }, function (err, data) {
    res.send(data);
  });
});

app.listen(config.port);
