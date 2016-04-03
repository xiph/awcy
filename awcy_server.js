var express = require('express');
var path = require('path');
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var fs = require('fs');
var cp = require('child_process');
var irc = require('irc');
var AWS = require('aws-sdk');
var app = express();

var have_aws = true;
try {
  AWS.config.loadFromPath('./aws.json');
} catch(err) {
  console.log('Starting without AWS support.');
}

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

var job;
var job_queue = [];
var job_in_progress = false;
var job_child_process = null;
var job_log = ''
var last_job_completed_time = Date.now();

var key = fs.readFileSync('secret_key', {encoding: 'utf8'}).trim();

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

function process_queue() {
  cp.exec('node generate_list.js');
  if (job_in_progress) { return; };
  if (job_queue.length > 0) {
    job_in_progress = true;
    job = job_queue.shift();
    console.log('Starting job '+job.run_id);
    ircclient.say(channel,job.nick+': Starting '+job.run_id);
    var env = process.env;
    env['LANG'] = 'en_US.UTF-8';
    env['CODEC'] = job.codec;
    env['EXTRA_OPTIONS'] = job.extra_options;
    env['BUILD_OPTIONS'] = job.build_options;
    env['RUN_ID'] = job.run_id;
    if (job.qualities) {
      env['QUALITIES'] = job.qualities;
    }
    if (job.videos) {
      job_child_process = cp.spawn('./run_video_test2.sh',
        [job.commit,job.run_id].concat(job.videos),
        { env: env });
    } else {
      job_child_process = cp.spawn('./run_video_test.sh',
        [job.commit,job.run_id,job.task],
        { env: env });
    }
    job_log = ''
    job_child_process.stdout.on('data', function(data) {
      console.log(data.toString());
      job_log += data;
    });
    job_child_process.stderr.on('data', function(data) {
      console.log(data.toString());
      job_log += data;
    });
    job_child_process.on('close', function(error) {
      if (error == 0) {
        console.log('video test succeeded');
        ircclient.say(channel,job.nick+': Finished '+job.run_id);
      } else {
        ircclient.say(channel,job.nick+': Exploded '+job.run_id+
          ' see https://arewecompressedyet.com/error.txt');
      }
      fs.writeFile('runs/'+job.run_id+'/output.txt',job_log);
      fs.writeFile('error.txt',job_log);
      job_in_progress = false;
      job = null;
      last_job_completed_time = Date.now();
      process_queue();
    });
  }
};

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

app.get('/job_queue.json',function(req,res) {
  res.json(job_queue);
});

app.get('/job',function(req,res) {
  res.json(job);
});

app.get('/job_log',function(req,res) {
  res.send(job_log);
});

autoScalingInstances = null;
autoScalingGroups = null;

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
  if ((!job_in_progress) && (job_queue.length == 0)) {
    var shutdown_threshold = 1000*60*5; // 5 minutes
    if ((Date.now() - last_job_completed_time) > shutdown_threshold) {
      console.log("Shutting down all Amazon instances because idle.");
      shutdownAmazon();
    }
  }
}

if (have_aws) {
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
    cp.execFile('./bd_rate_report.py',[__dirname+'/runs/'+a,__dirname+'/runs/'+b,__dirname+'/runs/vp9-anchor-ntt-short-1c'],
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
  job.codec = 'daala';
  job.commit = req.body.commit;
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
  job_queue.push(job);
  process_queue();
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
  var index = job_queue.indexOf(job_queue.find(function(job) { return job.run_id == run; }));
  if (index < 0) {
    res.send('job not found');
  } else {
    job_queue.splice(index, 1);
    res.send('ok');
  }
});

app.post('/submit/kill',function(req,res) {
  job_child_process.kill('SIGTERM');
  job_child_process.kill('SIGKILL');
  res.send(job_child_process.pid);
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

app.listen(3000);
