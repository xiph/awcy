'use strict';

import express = require('express');
import path = require('path');
import bodyParser = require('body-parser')
import cookieParser = require('cookie-parser')
import fs = require('fs-extra');
import cp = require('child_process');
import irc = require('irc');
import AWS = require('aws-sdk');
import request = require('request');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser())
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};
app.use(allowCrossDomain);

const config = require('./config.json');

const channel = config.channel;

AWS.config.update({region: 'us-west-2'});

const ircclient = new irc.Client('irc.freenode.net', 'XiphAWCY', {
    channels: [channel],
});
ircclient.addListener('error', function(message) {
    console.log('error: ', message);
});

const key = fs.readFileSync('secret_key', {encoding: 'utf8'}).trim();

const last_job_completed_time = Date.now();

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

const binaries = {
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

let build_job;
const build_job_queue = [];
let run_job;
const run_job_queue = [];
let run_job_in_progress = false
let build_job_in_progress = false;
let build_job_child_process = null;
let run_job_child_process = null;
let last_run_job_completed_time = Date.now();

function process_build_queue() {
  if (build_job_in_progress) { return; };
  if (build_job_queue.length > 0) {
    build_job_in_progress = true;
    build_job = build_job_queue.shift();
    console.log('Starting build_job '+build_job.run_id);
    const env = process.env;
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
    const job_log = ''
    build_job_child_process.stdout.on('data', function(data) {
      console.log(data.toString());
      fs.appendFile('runs/'+build_job.run_id+'/output.txt',data);
    });
    build_job_child_process.stderr.on('data', function(data) {
      console.log(data.toString());
      fs.appendFile('runs/'+build_job.run_id+'/output.txt',data);
    });
    build_job_child_process.on('close', function(error) {
      if (error == 0) {
        for (const binary of binaries[build_job.codec]) {
          fs.mkdirsSync('runs/'+build_job.run_id+'/x86_64/'+path.dirname(binary));
          fs.copySync(build_job.codec+'/'+binary,'runs/'+build_job.run_id+'/x86_64/'+binary);
        }
        try {
          fs.mkdirSync('runs/'+build_job.run_id+'/js');
          fs.copySync(build_job.codec+'/asm/examples/decoder.js','runs/'+build_job.run_id+'/js/decoder.js');
        } catch (e) {
          /* no analyzer */
        }
        add_to_run_queue(build_job);
      } else {
        ircclient.say(channel,build_job.nick+': Failed to build! '+build_job.run_id+
          ' '+config.base_url+'/runs/'+build_job.run_id+'/output.txt');
      }
      build_job_in_progress = false;
      build_job = undefined;
      process_build_queue();
    });
  }
};

function add_to_run_queue(job) {
  ircclient.say(channel,run_job.nick+': Starting '+run_job.run_id);
  request(config.rd_server_url+'/submit?run_id='+job.run_id, function (error, response, body) {
    console.log(error);
    console.log(body);
  });
}

express.static.mime.define({'text/plain': ['out']});
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

// The typings for aws-sdk are incomplete, so we declare an empty
// AutoScaling class and cast it to 'any' when we use it.
declare module "aws-sdk" {
  export class AutoScaling {
  }
}

function shutdownAmazon() {
  /* blank for now, should talk to rd_server.py */
}

function pollAmazon() {
  const autoscaling: any = new AWS.AutoScaling();
  autoscaling.describeAutoScalingInstances({},function(err,data) {
    if (err) {
      console.log(err);
    } else {
      autoScalingInstances = data;
    }
  });
  autoscaling.describeAutoScalingGroups({AutoScalingGroupNames: [config.scaling_group]}, function(err,data) {
    autoScalingGroups = data;
  });
  if ((!run_job_in_progress) && (run_job_queue.length == 0)) {
    const shutdown_threshold = 1000*60*30.5; // 30.5 minutes
    if ((Date.now() - last_run_job_completed_time) > shutdown_threshold) {
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

app.get('/run_status.json', function(req, res) {
  request(config.rd_server_url+'/run_list.json', function (error, response, body) {
    res.send(body);
  });
});

app.get('/bd_rate',function(req,res) {
  if (!(req.query['a'] && req.query['b'])) {
    res.send('');
    return;
  }
  const a = path.basename(req.query['a']);
  const b = path.basename(req.query['b']);
  const min_bpp = req.query['min_bpp'];
  const max_bpp = req.query['max_bpp'];
  const metric_score = req.query['metric_score'];
  const file = path.basename(req.query['file']);
  const set = path.basename(req.query['set']);
  const a_file = __dirname+'/runs/'+a+'/'+set+'/'+file;
  const b_file = __dirname+'/runs/'+b+'/'+set+'/'+file;
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
    const parameters = [__dirname+'/runs/'+a,__dirname+'/runs/'+b,'--anchordir',__dirname+'/runs/','--suffix=-daala.out','--overlap'];
    if (req.query['format'] == 'json') {
      res.contentType('application/json');
      parameters.push('--format=json');
    }
    cp.execFile('./bd_rate_report.py',parameters,
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
  if (!req.body.codec) {
    req.body.codec = 'daala';
  }
  if (!req.body.nick) {
    req.body.nick = 'AWCY'
  }
  if (!req.body.extra_options) {
    req.body.extra_options = ''
  }
  if (!req.body.build_options) {
    req.body.build_options = ''
  }
  const job = {
    'codec': req.body.codec,
    'commit': req.body.commit,
    'nick': req.body.nick,
    'run_id': req.body.run_id.replace(' ','_'),
    'task': req.body.task,
    'extra_options': req.body.extra_options,
    'build_options': req.body.build_options,
    'qualities': req.body.qualities,
    'master': req.body.master,
    'ab_compare': req.body.ab_compare,
    'save_encode': req.body.save_encode,
    'task_type': 'video'
  }

  const gerrit_detect_re = /I[0-9a-f].*/g;
  if (gerrit_detect_re.test(job.commit)) {
    res.status(400).send('Error: Commit looks like a Gerrit Change-Id. Use the commit hash instead.');
    return;
  }
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
  const run = path.basename(req.body.run_id);
  cp.execFile('nuke_branch.sh',[run],
              function(error,stdout,stderr) {
    res.send(stderr+stdout);
  });
});

app.post('/submit/cancel',function(req,res) {
  const run = req.body.run_id;
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
  const autoscaling: any = new AWS.AutoScaling();
  autoscaling.setDesiredCapacity({
    AutoScalingGroupName: config.scaling_group,
    DesiredCapacity: req.body.DesiredCapacity,
    HonorCooldown: false
  }, function (err, data) {
    res.send(data);
  });
});

app.listen(config.port);
