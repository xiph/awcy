var express = require('express');
var path = require('path');
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var fs = require('fs');
var cp = require('child_process');
var irc = require('irc');
var AWS = require('aws-sdk');
var app = express();

AWS.config.loadFromPath('./aws.json');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser())

var ircclient = new irc.Client('irc.freenode.net', 'XiphAWCY', {
    channels: ['#daala'],
});
ircclient.addListener('error', function(message) {
    console.log('error: ', message);
});

var job;
var job_queue = [];
var job_in_progress = false;
var job_child_process = null;

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
    job = job_queue.pop();
    console.log('Starting job '+job.run_id);
    ircclient.say('#daala',job.nick+': Starting '+job.run_id);
    job_child_process = cp.execFile('./run_video_test.sh',
      [job.commit,job.run_id,job.task],
      { env: { 'PYTHONIOENCODING': 'utf-8' } },
      function(error,stdout,stderr) {
      if (error == null) {
        console.log('video test succeeded');
        ircclient.say('#daala',job.nick+': Finished '+job.run_id);
      } else {
        console.log(stdout);
        console.log(stderr);
        ircclient.say('#daala',job.nick+': Exploded '+job.run_id+
          ' see https://arewecompressedyet.com/error.txt');
        fs.writeFile('error.txt',stdout+stderr);
      }
      job_in_progress = false;
      job = null;
      process_queue();
    });
  }
};

app.use(express.static(__dirname + '/www'));
app.use('/runs',express.static(__dirname + '/runs'));
app.use('/sets.json',express.static(__dirname + '/rd_tool/sets.json'));
app.use('/error.txt',express.static(__dirname + '/error.txt'));
app.use('/list.json',express.static(__dirname + '/list.json'));

app.get('/run_list.json',function(req,res) {
  fs.readdir('runs',function(err,files) {
    res.send(files);
  });
});

app.get('/job_queue.json',function(req,res) {
  res.send(JSON.stringify(job_queue));
});

app.get('/job',function(req,res) {
  res.send(JSON.stringify(job));
});

app.get('/describeAutoScalingInstances',function(req,res) {
  var autoscaling = new AWS.AutoScaling();
  autoscaling.describeAutoScalingInstances({},function(err,data) {
    res.send(JSON.stringify(data));
  });
});

app.get('/bd_rate',function(req,res) {
  var a = path.basename(req.query['a']);
  var b = path.basename(req.query['b']);
  var file = path.basename(req.query['file']);
  var set = path.basename(req.query['set']);
  var a_file = __dirname+'/runs/'+a+'/'+set+'/'+file;
  var b_file = __dirname+'/runs/'+b+'/'+set+'/'+file;
  cp.execFile('./bd_rate.m',[a_file,b_file],
              {env: {'BUILD_ROOT': 'daalatool/'}, cwd: __dirname+'/daalatool/tools/matlab/'},
              function(error,stdout,stderr) {
    res.send(stdout);
  });
});

app.use('/submit',check_key);

app.post('/submit/job',function(req,res) {
  var job = {};
  job.codec = 'daala';
  job.commit = req.body.commit;
  job.run_id = req.body.run_id;
  if (req.body.task) {
    job.task = req.body.task;
  } else {
    job.task = 'video-1-short';
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

app.post('/submit/kill',function(req,res) {
  job_child_process.kill();
});

app.listen(3000);
