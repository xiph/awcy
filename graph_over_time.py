#!/usr/bin/python2

import json
import subprocess
import time
import calendar
import dateutil.parser
import datetime

runs = json.load(open("list.json","r"))

watermark_runs = ['x265_1.6_ntt-short-1','x264_ntt']
watermark_data = {}

psnr = []
psnrhvs = []
ssim = []
fastssim = []

def unix_time(dt):
    epoch = datetime.datetime.utcfromtimestamp(0)
    delta = dt - epoch
    return delta.total_seconds()

for run in runs:
  is_watermark_run = run['run_id'] in watermark_runs
  is_master_run = (u'master' in run['info']) and (u'ntt-short-1' in run['info']['task'])
  if is_watermark_run or is_master_run:
    filename = 'runs/'+run['run_id']+'/'+run['info']['task']+'/total.out'
    try:
      distortion = subprocess.check_output(['./distortion.m',filename,'0.1'])
      if is_master_run:
        date_str = subprocess.check_output(['git','--git-dir=daala/.git','--work-tree=daala/','show','-s','--format=%ci',run['info']['commit']])
        date_obj = dateutil.parser.parse(date_str).replace(tzinfo=None)
        date_js = unix_time(date_obj) * 1000
        psnr.append([date_js,distortion.split('\n')[0]])
        psnrhvs.append([date_js,distortion.split('\n')[1]])
        ssim.append([date_js,distortion.split('\n')[2]])
        fastssim.append([date_js,distortion.split('\n')[3]])
      if is_watermark_run:
        watermark_run = run['info']['codec']
        watermark_data[watermark_run] = {}
        watermark_data[watermark_run]['psnr'] = distortion.split('\n')[0]
        watermark_data[watermark_run]['psnrhvs'] = distortion.split('\n')[1]
        watermark_data[watermark_run]['ssim'] = distortion.split('\n')[2]
        watermark_data[watermark_run]['fastssim'] = distortion.split('\n')[3]
    except subprocess.CalledProcessError:
      continue

output = [psnr, psnrhvs, ssim, fastssim]
json.dump(output,open('time_series.json','w'))
json.dump(watermark_data,open('watermark.json','w'))
