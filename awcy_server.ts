'use strict';

import express = require('express');
import path = require('path');
import bodyParser = require('body-parser')
import cookieParser = require('cookie-parser')
import fs = require('fs-extra');
import archiver = require('archiver');
import cp = require('child_process');
import irc = require('irc');
import AWS = require('aws-sdk');
import request = require('request');
import querystring = require('querystring');
import sqlite3 = require('sqlite3');

const app = express();

let app_dir = process.env['APP_DIR'] || __dirname;
let config_dir = process.env['CONFIG_DIR'] || __dirname;
let codecs_src_dir = process.env['CODECS_SRC_DIR'] || __dirname;
let medias_src_dir = process.env['MEDIAS_SRC_DIR'] || __dirname;
let runs_dst_dir = process.env['RUNS_DST_DIR'] || __dirname+'/runs';
let external_addr = process.env['EXTERNAL_ADDR'] || 'localhost';

var sdb = new sqlite3.Database(config_dir+'/subjective.sqlite3');

app.enable('trust proxy');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser())
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};
app.use(allowCrossDomain);

const config = require(config_dir+'/config.json');

const channel = config.channel;

AWS.config.update({region: 'us-west-2'});

var ircclient = null;
if (channel != "none") {
  ircclient = new irc.Client('irc.libera.chat', 'XiphAWCY', {
      channels: [channel],
  });
  ircclient.addListener('error', function(message) {
      console.log('error: ', message);
  });
}

const key = fs.readFileSync(config_dir+'/secret_key', {encoding: 'utf8'}).trim();

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

function generate_list(run_id) {
  if (run_id) {
    cp.execFile('node',['generate_list.js',run_id]);
  } else {
    cp.exec('node generate_list.js');
  }
}

const binaries = {
  'daala':['examples/encoder_example','examples/dump_video'],
  'x264': ['x264'],
  'x265': ['build/linux/x265'],
  'xvc': ['build/app/xvcenc', 'build/app/xvcdec'],
  'vp8': ['vpxenc','vpxdec'],
  'vp9': ['vpxenc','vpxdec'],
  'vp10': ['vpxenc','vpxdec'],
  'vp10-rt': ['vpxenc','vpxdec'],
  'av1': ['aomenc','aomdec'],
  'av1-rt': ['aomenc','aomdec'],
  'av2-ai': ['aomenc','aomdec'],
  'av2-ra': ['aomenc','aomdec'],
  'av2-ra-st': ['aomenc','aomdec'],
  'av2-ld': ['aomenc','aomdec'],
  'av2-as': ['aomenc','aomdec'],
  'av2-as-st': ['aomenc','aomdec'],
  'thor': ['build/Thorenc','build/Thordec','config_HDB16_high_efficiency.txt','config_LDB_high_efficiency.txt'],
  'thor-rt': ['build/Thorenc','build/Thordec','config_HDB16_high_efficiency.txt','config_LDB_high_efficiency.txt'],
  'rav1e': ['target/release/rav1e'],
  'svt-av1': ['Bin/Release/SvtAv1EncApp'],
  'vvc-vtm': ['bin/EncoderAppStatic', 'bin/DecoderAppStatic']
};

/* The build queue. Only one job can be built at a time. */

let build_job;
const build_job_queue = [];
let run_job;
let run_job_in_progress = false
let build_job_in_progress = false;
let build_job_child_process = null;
let last_run_job_completed_time = Date.now();

function process_build_queue() {
  if (build_job_in_progress) { return; };
  if (build_job_queue.length > 0) {
    build_job_in_progress = true;
    build_job = build_job_queue.shift();
    console.log('Starting build_job '+build_job.run_id);
    fs.writeFile(runs_dst_dir+'/'+build_job.run_id+'/status.txt','building');
    const env = {...process.env};
    env['LANG'] = 'en_US.UTF-8';
    env['CODEC'] = build_job.codec;
    env['EXTRA_OPTIONS'] = build_job.extra_options;
    env['BUILD_OPTIONS'] = build_job.build_options;
    env['RUN_ID'] = build_job.run_id;
    env['ARCH'] = build_job.arch ? build_job.arch : 'x86_64';
    env['APP_DIR'] = app_dir;
    env['CODECS_SRC_DIR'] = codecs_src_dir;
    env['MEDIAS_SRC_DIR'] = medias_src_dir;
    env['RUNS_DST_DIR'] = runs_dst_dir;
    build_job_child_process = cp.spawn('./create_test_branch.sh',
      [build_job.commit, build_job.run_id, build_job.codec],
      { env: env, shell: true });
    const job_log = ''
    build_job_child_process.stdout.on('data', function(data) {
      console.log(data.toString());
      fs.appendFile(runs_dst_dir+'/'+build_job.run_id+'/output.txt',data);
    });
    build_job_child_process.stderr.on('data', function(data) {
      console.log(data.toString());
      fs.appendFile(runs_dst_dir+'/'+build_job.run_id+'/output.txt',data);
    });
    build_job_child_process.on('close', function(error) {
      if (error == 0) {
        try {
          for (const binary of binaries[build_job.codec]) {
            const arch = build_job.arch ? build_job.arch : "x86_64";
            fs.mkdirsSync(runs_dst_dir+'/'+build_job.run_id+'/'+arch+'/'+path.dirname(binary));
            fs.copySync(codecs_src_dir+'/'+build_job.codec+'/'+binary,runs_dst_dir+'/'+build_job.run_id+'/'+arch+'/'+binary);
          }
        } catch (e) {
          console.log(e);
          fs.appendFile(runs_dst_dir+'/'+build_job.run_id+'/output.txt',e);
          error = 1;
        }
        try {
          fs.mkdirSync(runs_dst_dir+'/'+build_job.run_id+'/js');
          fs.copySync(codecs_src_dir+'/'+build_job.codec+'/aomanalyzer.js',runs_dst_dir+'/'+build_job.run_id+'/js/decoder.js');
        } catch (e) {
          /* no analyzer */
        }
      }
      if (error) {
        fs.writeFile(runs_dst_dir+'/'+build_job.run_id+'/status.txt','buildfailed');
        if (ircclient) {
          ircclient.say(channel,build_job.nick+': Failed to build! '+build_job.run_id+
                      ' '+config.base_url+'/runs/'+build_job.run_id+'/output.txt');
        }
        generate_list(build_job.run_id);
      } else {
        add_to_run_queue(build_job);
      }
      build_job_in_progress = false;
      build_job = undefined;
      process_build_queue();
    });
  }
};

function add_to_run_queue(job) {
  if (ircclient) {
    ircclient.say(channel,job.nick+': Starting '+job.run_id);
  }
  request(config.rd_server_url+'/submit?'+querystring.stringify({run_id: job.run_id}), function (error, response, body) {
    console.log(error);
    console.log(body);
  });
  fs.writeFile(runs_dst_dir+'/'+job.run_id+'/status.txt','waiting');
  generate_list(job.run_id);
}

express.static.mime.define({'text/plain': ['out']});
app.use(express.static(__dirname + '/www'));
app.use('/analyzer',express.static(__dirname + '/../aomanalyzer'));
app.get('/analyzer.html', function(req,res) {
  res.redirect('/analyzer' + req.originalUrl.substr(req.originalUrl.indexOf("?")));
});
app.use('/runs',express.static(runs_dst_dir));
app.use('/sets.json',express.static(__dirname + '/rd_tool/sets.json'));
app.use('/error.txt',express.static(__dirname + '/error.txt'));
app.use('/list.json',express.static(config_dir + '/list.json'));
app.use('/ab_paths.json',express.static(__dirname + '/ab_paths.json'));
app.use('/time_series.json',express.static(__dirname + '/time_series.json'));
app.use('/watermark.json',express.static(__dirname + '/watermark.json'));

app.get('/run_list.json',function(req,res) {
  fs.readdir(runs_dst_dir,function(err,files) {
    res.send(files);
  });
});

app.get('/build_job_queue.json',function(req,res) {
  res.json(build_job_queue);
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
  res.contentType('application/json');
  request(config.rd_server_url+'/run_status.json', function (error, response, body) {
    res.send(body);
  });
});

app.get('/machine_usage.json', function(req, res) {
  res.contentType('application/json');
  request(config.rd_server_url+'/machine_usage.json', function (error, response, body) {
    res.send(body);
  });
});

// polling rd_server to update list and issue IRC notifications
let last_runs = {};
function check_for_completed_runs() {
  request(config.rd_server_url+'/run_status.json', function (error, response, body) {
    if (!error) {
      let current_runs = {};
      for (let run of JSON.parse(body)) {
        current_runs[run.run_id] = run;
      }
      var list_updated = false;
      for (let runid in last_runs) {
        if (!(runid in current_runs)) {
          list_updated = true;
          if (ircclient) {
            ircclient.say(channel,last_runs[runid]['info']['nick']+': Finished '+runid);
          }
        }
      }
      if (list_updated) generate_list(null);
      last_runs = current_runs;
    }
  });
};

setInterval(check_for_completed_runs, 10*1000);

app.get('/bd_rate',function(req,res) {
  if (!(req.query['a'] && req.query['b'])) {
    res.send('');
    return;
  }
  const a = path.basename(String(req.query['a']));
  const b = path.basename(String(req.query['b']));
  const min_bpp = String(req.query['min_bpp']);
  const max_bpp = String(req.query['max_bpp']);
  const metric_score = req.query['metric_score'];
  const file = path.basename(String(req.query['file']));
  const set = path.basename(String(req.query['set']));
  const a_file = runs_dst_dir+'/'+a+'/'+set+'/'+file;
  const b_file = runs_dst_dir+'/'+b+'/'+set+'/'+file;
  if (req.query['method'] == 'jm') {
    cp.execFile('./bd_rate_jm.m',[a_file,b_file],
                {},
                function(error,stdout,stderr) {
      res.send(stdout);
    });
  } else if (req.query['method'] == 'report') {
    cp.execFile('./bd_rate_report.py',[runs_dst_dir+'/'+a,runs_dst_dir+'/'+b,'--anchordir',runs_dst_dir+'/','--suffix=-daala.out'],
                {},
                function(error,stdout,stderr) {
      if (error) {
        res.send(stderr + stdout);
      } else {
        res.send(stdout);
      }
    });
  } else if (req.query['method'] == 'report-overlap') {
    const parameters = [runs_dst_dir+'/'+a,runs_dst_dir+'/'+b,'--anchordir',runs_dst_dir+'/','--suffix=-daala.out','--overlap'];
    if (req.query['format'] == 'json') {
      res.contentType('application/json');
      parameters.push('--format=json');
    }
    if (req.query['range'] == 'fullrange') {
      parameters.push('--fullrange')
    }
    if (req.query['interpolation'] == 'pchip-old') {
      parameters.push('--old-pchip')
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
  } else if (req.query['method'] == 'report-as') {
    const parameters = [runs_dst_dir+'/'+a,runs_dst_dir+'/'+b,'--suffix=-daala.out','--overlap'];
    if (req.query['format'] == 'json') {
      res.contentType('application/json');
      parameters.push('--format=json');
    }
    if (req.query['interpolation'] == 'pchip-old') {
      parameters.push('--old-pchip')
    }
    cp.execFile('./bd_rate_report_as.py',parameters,
                {},
                function(error,stdout,stderr) {
      if (error) {
        res.send(stderr + stdout);
      } else {
        res.send(stdout);
      }
    });
  } else if (req.query['method'] == 'metric-point') {
    cp.execFile('./rate_delta_point.py',[a_file,b_file,String(metric_score)],
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

// AOM-CTC XLSM Template endpoint
// Requires Two Jobs as arguments.
app.get('/ctc_report.xlsm', function (req, res) {
  if (!req.query['a']) {
    res.send('No Run A specified');
    return;
  }
  if (!req.query['b']) {
    res.send('No Run B specified');
    return;
  }
  const a = path.basename(String(req.query['a']));
  const b = path.basename(String(req.query['b']));
  const codec_a = path.basename(String(req.query['codec_a']))
  const codec_b = path.basename(String(req.query['codec_b']))
  const a_file = runs_dst_dir + '/' + a;
  const b_file = runs_dst_dir + '/' + b;
  let filename_to_send = 'AOM_CWG_Regular_CTCv3_v7.2-' + a + '-' + b + '.xlsm';
  if ((codec_a == 'av2-as' || codec_a == 'av2-as-st') && (codec_b == 'av2-as' || codec_b == 'av2-as-st')) {
  filename_to_send = 'AOM_CWG_AS_CTC_v9.7-' + a + '-' + b + '.xlsm';
  }
  console.log(filename_to_send, codec_a, String(req.query['codec_a']));
  console.log(runs_dst_dir)
  res.header("Content-Type", "application/vnd.ms-excel.sheet.macroEnabled.12");
  res.header('Content-Disposition', 'attachment; filename="' + filename_to_send + '"');
  cp.execFile('./csv_export.py', [a_file, '--ctc_export', '--run_b=' + b_file],
    {},
    function (error, stdout, stderr) {
      if (error) {
        res.send(stdout + stderr);
        throw error;
      } else {
        res.sendFile(path.join(runs_dst_dir, '/ctc_results/' + filename_to_send));
      }
    });
});

app.use('/submit',check_key);

app.use('/submit/check',function(req,res) {
  res.send('ok');
});

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
  if (!req.body.save_encode) {
    req.body.save_encode = true
  }
  if (!req.body.ctcSets) {
    req.body.ctcSets = []
  } else {
    req.body.ctcSets = req.body.ctcSets.split(',')
  }
  if (!req.body.ctcPresets) {
    req.body.ctcPresets = []
  } else {
    req.body.ctcPresets = req.body.ctcPresets.split(',')
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
    'task_type': 'video',
    'arch': req.body.arch,
    'ctcSets': req.body.ctcSets,
    'ctcPresets': req.body.ctcPresets,
  }

  const gerrit_detect_re = /I[0-9a-f]{40}/g;
  if (gerrit_detect_re.test(job.commit)) {
    res.status(400).send('Error: Commit looks like a Gerrit Change-Id. Use the commit hash instead.');
    return;
  }
  if (job.run_id.length > 256) {
    res.status(400).send('Choose a shorter run id, silly.\n');
  }
  if (fs.existsSync(runs_dst_dir+'/'+job.run_id)) {
    res.status(400).send('ID is not unique! Choose another.\n');
    return;
  }

  // create runs root directory if not exists
  if (!fs.existsSync(runs_dst_dir)) {
    console.log("Creating 'runs' root directory")
    fs.mkdirSync(runs_dst_dir);
  }

  fs.mkdirSync(runs_dst_dir+'/'+job.run_id);
  fs.writeFile(runs_dst_dir+'/'+job.run_id+'/info.json',JSON.stringify(job));
  fs.writeFile(runs_dst_dir+'/'+job.run_id+'/status.txt','new');
  build_job_queue.push(job);
  process_build_queue();
  generate_list(job.run_id);
  res.send('ok');
});

app.get('/csv_export.csv',function(req,res) {
  if (!req.query['a']) {
    res.send('No run specified');
    return;
  }
  const a = path.basename(String(req.query['a']));
  const a_file = runs_dst_dir+'/'+a;
  res.header("Content-Type", "text/csv");
  res.header('Content-Disposition', 'attachment; filename="'+a+'.csv"')
  cp.execFile('./csv_export.py',[a_file],
              {},
              function(error,stdout,stderr) {
                if (error) {
                  res.send(stderr);
                } else {
                  res.send(stdout);
                }
              });
});

app.get('/dump_convex_hull.json',function(req,res) {
  if (!req.query['a']) {
    res.send('No run specified');
    return;
  }
  if (!req.query['task']) {
    res.send('No task specified');
    return;
  }
  if (!req.query['video']) {
    res.send('No video specified');
    return;
  }
  const a = path.basename(String(req.query['a']));
  const video = path.basename(String(req.query['video']), '.y4m');
  const a_file = runs_dst_dir+'/'+a+'/'+req.query['task']+'/RDResults_'+video+'_aom_av1_0.xlsx';
  res.header("Content-Type", "application/json");
  cp.execFile('./dump_convex_hull.py',[a_file],
              {},
              function(error,stdout,stderr) {
                if (error) {
                  res.send(stderr);
                } else {
                  res.send(stdout);
                }
              });
});

// Create API Endpoint to download the Run folder as a zip
app.get('/download_run.zip', function (req, res) {
  if (!req.query['a']) {
    res.send('No Run ID specified');
    return;
  }
  const run_id = path.basename(String(req.query['a']));
  const tmp_run_zip = '/tmp/awcy_' + run_id + '.zip';
  const output = fs.createWriteStream(tmp_run_zip);
  const archive = archiver('zip', {
    zlib: { level: 4 } // Sets the compression level.
  });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', function () {
    console.log(archive.pointer() + ' total bytes for ', tmp_run_zip);
    console.log('Archiver has been finalized and the output file descriptor has closed.');
    // Set the Headers
    res.header("Content-Type", "application/zip");
    res.header('Content-Disposition', 'attachment; filename="' + run_id + '.zip' + '"');
    res.set('Content-Length', archive.pointer());
    // Send the file
    res.sendFile(path.resolve(tmp_run_zip));
  });
  // This event is fired when the data source is drained no matter what was the data source.
  output.on('end', function () {
    console.log('Data has been drained');
  });
  // good practice to catch this error explicitly
  archive.on('error', function (err) {
    throw err;
  });
  archive.pipe(output);
  const run_folder = runs_dst_dir + '/' + run_id;
  // Add the Run Folder to the archive
  archive.directory(run_folder, false);
  archive.finalize();
});

app.post('/submit/delete',function(req,res) {
  const run = path.basename(req.body.run_id);
  cp.execFile('nuke_branch.sh',[run],
              function(error,stdout,stderr) {
    res.send(stderr+stdout);
  });
});

app.post('/submit/cancel',function(req,res) {
  const run_id = req.body.run_id;
  console.log('Cancelling '+run_id);
  request(config.rd_server_url+'/cancel?'+querystring.stringify({run_id: run_id}), function (error, response, body) {
    res.send('ok');
  });
  fs.writeFile(runs_dst_dir+'/'+run_id+'/status.txt','cancelled');
  generate_list(run_id);
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

app.post('/update/analyzer', function(req,res) {
  console.log('updating analyzer from webhook');
  cp.execFile('./update_analyzer.sh',[],function(error,stdout,stderr) {
    res.send(stderr+stdout);
  });
});

app.use('/subjective/vote', bodyParser.json());
app.post('/subjective/vote', function(req,res) {
  console.log('recording vote');
  console.log(req.body);
  var decoders: Array<String> = [];
  const re = /https?:\/\/.*\/(.*\/.*)/g;
  const video = re.exec(req.body.videos[0].video)[1];
  var selected = -1;
  const videos = req.body.videos.sort(function(a,b) {
    if (a.decoder < b.decoder) {
      return -1;
    }
    if (a.decoder > b.decoder) {
      return 1;
    }
    return 0;
  });
  for (var video_idx in videos) {
    decoders.push(videos[video_idx].decoder);
    if (videos[video_idx].selected) {
      selected = parseInt(video_idx);
    }
  }
  sdb.run('INSERT INTO votes VALUES (?, ?, ?, ?, ?, ?, ?)',
          JSON.stringify(decoders),
          video,
          selected,
          req.body.id,
          JSON.stringify(req.body.metrics),
          req.body.voter,
          req.ip,
          function(e) {
            if (e) {
              console.log(e);
              res.send(e);
            } else {
              res.send('ok');
            }
          });
});

let server = app.listen(config.port);
server.setTimeout(600000, () => { });

console.log('AWCY server started! Open a browser at http://'+external_addr+':' + config.port);
console.log('')

// show directories
console.log('AWCY server directory: '+app_dir);
console.log('Configuration directory: '+config_dir);
console.log('Codecs git repositories location: '+codecs_src_dir);
console.log('Media samples directory: '+medias_src_dir);
console.log('Runs output directory: '+runs_dst_dir);
console.log('')

if (ircclient) {
  console.log('IRC notifications will be sent to channel '+channel);
} else {
  console.log('IRC notifications are disable as channel is set to "none"');
}
