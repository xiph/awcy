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
fs.writeFile('ab_paths.json', JSON.stringify(file_structure, null, 4));

// The structure is that each folder contains an array of files.
// Any folder found will be a new object with a new array inside it.
// This only includes folders and `.png` files. Folders without `png`
// files at the bottom layer are considered empty and not included.
function read_ab_image_paths(outer_path) {
  // An array of files and an object containing keys to all the folders.
  var entries = [];
  // An object with keys to all the folders.
  var folders = {};

  fs.readdirSync(outer_path).forEach(function(inner) {
      var inner_path = outer_path + '/' + inner;

      if (fs.statSync(inner_path).isDirectory()) {
          // A folder is an array of files and objects (folders).
          var folder = read_ab_image_paths(inner_path);

          // Don't add an empty folder.
          if (folder.length != 0) { folders[inner] = folder; }
      } else if (path.extname(inner) == '.png') { entries.push(inner); }
  });

  // Don't append an empty object if there were no folders.
  if (Object.keys(folders).length != 0) {
      entries.push(folders);
  }

  return entries;
}

