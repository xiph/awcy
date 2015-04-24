var fs = require('fs');

var jobs = [];

fs.readdirSync('runs').forEach(function(run_id) {
  var job = {}
  job.run_id = run_id;
  job.tasks = fs.readdirSync('runs/'+run_id);
  var stat = fs.statSync('runs/'+run_id);
  var info = {};
  try {
    var infoFile = fs.readFileSync('runs/'+run_id+'/info.json');
    info = JSON.parse(infoFile);
  } catch (e) {};
  job.date = stat.mtime;
  job.info = info;
  jobs.push(job);
});

fs.writeFile('list.json',JSON.stringify(jobs));


