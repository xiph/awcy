var express = require('express');
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
  if (job_in_progress) { return; };
  job_in_progress = true;
  if (job_queue.length > 0) {
    job = job_queue.pop();
    console.log('Starting job '+job.run_id);
    cp.execFile('./run_video_test.sh',[job.commit,job.run_id,job.task],function(error,stdout,stderr) {
      if (error == null) {
        console.log('video test succeeded');
        ircclient.say('#daala','AWCY: Finished '+job.run_id);
      } else {
        console.log(stdout);
        console.log(stderr);
        ircclient.say('#daala','AWCY: Exploded '+job.run_id);
      }
      job_in_progress = false;
      job = null;
      process_queue();
    });
  }
};

app.use(express.static(__dirname + '/www'));
app.use('/runs',express.static(__dirname + '/runs'));

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

app.use('/submit',check_key);

app.post('/submit/job',function(req,res) {
  // todo: check secret key
  var job = {};
  job.codec = 'daala';
  job.commit = req.body.commit;
  job.run_id = req.body.run_id;
  job.task = 'video-1-short';
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

app.listen(3000);
