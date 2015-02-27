#!/usr/bin/python2

import json
import subprocess
import time
import calendar
import dateutil.parser
import datetime

runs = json.load(open("list.json","r"))

psnr = []
psnrhvs = []
ssim = []
fastssim = []

def unix_time(dt):
    epoch = datetime.datetime.utcfromtimestamp(0)
    delta = dt - epoch
    return delta.total_seconds()

for run in runs:
  if u'master' in run['info']:
    filename = 'runs/'+run['run_id']+'/'+run['info']['task']+'/total.out'
    try:
      distortion = subprocess.check_output(['distortion.m',filename,'0.1'])
      date_str = subprocess.check_output(['git','--git-dir=daala/.git','--work-tree=daala/','show','-s','--format=%ci',run['info']['commit']])
      date_obj = dateutil.parser.parse(date_str).replace(tzinfo=None)
      date_js = unix_time(date_obj) * 1000
      psnr.append([date_js,distortion.split('\n')[0]])
      psnrhvs.append([date_js,distortion.split('\n')[1]])
      ssim.append([date_js,distortion.split('\n')[2]])
      fastssim.append([date_js,distortion.split('\n')[3]])
    except subprocess.CalledProcessError:
      continue

output = [psnr, psnrhvs, ssim, fastssim]
json.dump(output,open('time_series.json','w'))
