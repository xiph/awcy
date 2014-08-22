var express = require('express');
var path = require('path');
var bodyParser = require('body-parser')
var fs = require('fs');
var cp = require('child_process');
var irc = require('irc');
var app = express();

app.use(bodyParser.urlencoded({ extended: false }));

var ircclient = new irc.Client('irc.freenode.net', 'XiphAWCY', {
    channels: ['#daala'],
});
ircclient.addListener('error', function(message) {
    console.log('error: ', message);
});

var job;
var job_queue = [];
var job_in_progress = false;

var key = fs.readFileSync('secret_key', {encoding: 'utf8'}).trim();

function check_key(req,res,next) {
  if (key != req.body.key) {
    console.log(req.body.key.trim());
    console.log(key);
    res.status(403).send('Key verification failed.\n');
    return;
  }
  next();
};

function process_queue() {
  cp.exec('node generate_list.js');
  if (job_in_progress) { return; };
  if (job_queue.length > 0) {
    job_in_progress = true;
    job = job_queue.pop();
    console.log('Starting job '+job.run_id);
    cp.execFile('./run_video_test.sh',[job.commit,job.run_id,job.task],
    { env: { 'PYTHONIOENCODING': 'utf-8' } }, function(error,stdout,stderr) {
      if (error == null) {
        console.log('video test succeeded');
        ircclient.say('#daala','AWCY: Finished '+job.run_id);
      } else {
        console.log(stdout);
        console.log(stderr);
        ircclient.say('#daala','AWCY: Exploded '+job.run_id+
          ' see https://arewecompressedyet.com/error');
        fs.writeFile('error',stdout+stderr);
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
app.use('/error',express.static(__dirname + '/error'));
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
  job.task_type = 'video';
  if (fs.existsSync('runs/'+job.run_id)) {
    res.status(400).send('ID is not unique! Choose another.\n');
    return;
  }
  job_queue.push(job);
  process_queue();
  res.send('ok');
  ircclient.say('#daala','AWCY: Starting '+job.run_id);
});

app.post('/submit/delete',function(req,res) {
  var run = path.basename(req.body.run_id);
  cp.execFile('nuke_branch.sh',[run],
              function(error,stdout,stderr) {
    res.send(stderr+stdout);
  });
});

app.listen(3000);
