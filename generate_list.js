var fs = require('fs');
var path = require('path');

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

file_structure = read_ab_image_paths('runs');
fs.writeFile('ab_paths.json',JSON.stringify(file_structure, null, 4));

// The structure is that each folder contains an array of files.
// Any folder found will be a new object with a new array inside it.
// This only includes folders and `.png` files.
function read_ab_image_paths(outer_path) {
  var files = [];
  var folders = {};

  fs.readdirSync(outer_path).forEach(function(inner) {
      var inner_path = outer_path + '/' + inner;

      if (fs.statSync(inner_path).isDirectory()) {
          folders[inner] = read_ab_image_paths(inner_path);
      } else if (path.extname(inner) == '.png') { files.push(inner); }
  });

  // Don't append an empty object if there were no folders.
  if (Object.keys(folders).length != 0) {
      files.push(folders);
  }

  return files;
}

