// fs-extra provides deleting directories recursively so I don't
// have to manually implement it.
var fs = require('fs-extra');
var path = require('path');

var jobs = [];

fs.readdirSync('runs').forEach(function(run_id) {
  if (erases_old_images(run_id)) return;

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

fs.writeFileSync('list.json.new',JSON.stringify(jobs));
fs.renameSync('list.json.new','list.json');

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

function erases_old_images(run_id) {
    var stat = fs.statSync('runs/' + run_id);

    var info = {};
    try {
        var infoFile = fs.readFileSync('runs/'+run_id+'/info.json');
        info = JSON.parse(infoFile);
    } catch (e) {};

    // Never automatically erase special (reference) runs.
    if (info.special) { return false; }

    var age_ms = Date.now() - stat.mtime;
    var age_days = age_ms / (1000 * 3600 * 24);

    // Not old enough to erase files.
    if (age_days < 30) { return false; }

    var run_path = 'runs/' + run_id;
    var removed_images = false;

    // Remove images in the sets folder if it finds some.
    fs.readdirSync(run_path).forEach(function(inside_run) {
        var inside_run_path = run_path + '/' + inside_run;

        if (fs.statSync(inside_run_path).isDirectory()) {
            var set_path = inside_run_path;

            fs.readdirSync(set_path).forEach(function(inside_set) {
                var inside_set_path = set_path + '/' + inside_set;

                if (fs.statSync(inside_set_path).isDirectory()) {
                    removed_images = true;
                    fs.removeSync(inside_set_path);
                }
            });
        }
    });

    if (removed_images) {
        console.log('ab images for', run_id, 'were removed since they were', age_days.toFixed(1), 'days old.');

        return true;
    }

    return false;
}
