// fs-extra provides deleting directories recursively so I don't
// have to manually implement it.
import fs = require('fs-extra');
import path = require('path');
import glob = require('glob');

const run_to_update = process.argv[2];
const config_dir = process.env['CONFIG_DIR'] || process.env['PWD'];
const runs_dst_dir = process.env['RUNS_DST_DIR'] || process.env['PWD']+'/runs';
const listfile = config_dir + '/list.json';

function create_list_entry(run_id) {
  // TODO: define a typescript interface for info.json
  let info: any = {};

  const infoFile = fs.readFileSync(runs_dst_dir+'/'+run_id+'/info.json').toString();
  info = JSON.parse(infoFile);

  const stat = fs.statSync(runs_dst_dir+'/'+run_id);
  let failed = false;
  let status = 'completed';
  try {
    const statusFile = fs.readFileSync(runs_dst_dir+'/'+run_id+'/status.txt','utf8');
    status = statusFile.trim();
  } catch (e) {
    try {
      const total_stat = fs.statSync(runs_dst_dir+'/'+run_id+'/'+info['task']);
    } catch(e) {
      failed = true;
      status = 'failed';
    }
  }

  const job = {
    'run_id': run_id,
    'tasks': fs.readdirSync(runs_dst_dir+'/'+run_id),
    'date': stat.mtime,
    'info': info,
    'status': status,
    'failed': failed
  }

  return job;
}

if (run_to_update) {
  // incremental update
  console.log('Performing incremental update on',run_to_update);
  const list = JSON.parse(fs.readFileSync(listfile).toString());
  const new_job = create_list_entry(run_to_update);
  var found_job = false;
  for (var job_num in list) {
    if (list[job_num].run_id == new_job.run_id) {
      list[job_num] = new_job;
      found_job = true;
    }
  }
  if(!found_job) {
    list.push(new_job);
  }
  const tmpname = listfile + '.' + Math.random().toString(36).slice(2);
  fs.writeFileSync(tmpname,JSON.stringify(list));
  fs.renameSync(tmpname, listfile);
} else {
  const jobs = [];
  // full update
  fs.readdirSync(runs_dst_dir).forEach(function(run_id) {
    try {
      // if (erases_old_images(run_id)) return;
      const job = create_list_entry(run_id);
      erase_old_ivf_files(job);
      jobs.push(job);
    } catch (e) {};
  });

  const tmpname = listfile + '.' + Math.random().toString(36).slice(2);
  fs.writeFileSync(tmpname, JSON.stringify(jobs));
  fs.renameSync(tmpname, listfile);

  const file_structure = read_ab_image_paths(runs_dst_dir);
  fs.writeFile('ab_paths.json', JSON.stringify(file_structure, null, 4));

}

function erase_old_ivf_files(job) {
  const stat = fs.statSync(runs_dst_dir+'/' + job.run_id);
  const age_ms = Date.now().valueOf() - stat.mtime.valueOf();
  const age_days = age_ms / (1000 * 3600 * 24);
  // Not old enough to erase files
  if (age_days < 90) { return false; }
  const files = glob.sync(runs_dst_dir+'/' + job.run_id + '/' + job.info.task + '/*.ivf');
  if (files.length) {
    console.log('Erasing old IVF files for ',job.run_id);
    for (let file of files) {
      fs.unlinkSync(file);
    }
  }
}

// The structure is that each folder contains an array of files.
// Any folder found will be a new object with a new array inside it.
// This only includes folders and `.png` files. Folders without `png`
// files at the bottom layer are considered empty and not included.
function read_ab_image_paths(outer_path) {
  // An array of files and an object containing keys to all the folders.
  const entries = [];
  // An object with keys to all the folders.
  const folders = {};

  fs.readdirSync(outer_path).forEach(function(inner) {
      const inner_path = outer_path + '/' + inner;

      if (fs.statSync(inner_path).isDirectory()) {
          // A folder is an array of files and objects (folders).
          const folder = read_ab_image_paths(inner_path);

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
    const stat = fs.statSync(runs_dst_dir+'/' + run_id);

    // TODO: define a typescript interface for info.json
    let info: any = {};
    try {
        const infoFile = fs.readFileSync(runs_dst_dir+'/'+run_id+'/info.json').toString();
        info = JSON.parse(infoFile);
    } catch (e) {};

    // Never automatically erase special (reference) runs.
    if (info.special) { return false; }

    const age_ms = Date.now().valueOf() - stat.mtime.valueOf();
    const age_days = age_ms / (1000 * 3600 * 24);

    // Not old enough to erase files.
    if (age_days < 30) { return false; }

    const run_path = runs_dst_dir+'/' + run_id;
    let removed_images = false;

    // Remove images in the sets folder if it finds some.
    fs.readdirSync(run_path).forEach(function(inside_run) {
        const inside_run_path = run_path + '/' + inside_run;

        if (fs.statSync(inside_run_path).isDirectory()) {
            const set_path = inside_run_path;

            fs.readdirSync(set_path).forEach(function(inside_set) {
                const inside_set_path = set_path + '/' + inside_set;

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
