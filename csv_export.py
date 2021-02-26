#!/usr/bin/env python

import argparse
import json
import os
import csv
import sys
import re
from numpy import *

#offset by 3
met_index = {'PSNR': 0, 'PSNRHVS': 1, 'SSIM': 2, 'FASTSSIM': 3, 'CIEDE2000': 4,
             'PSNR Cb': 5, 'PSNR Cr': 6, 'APSNR': 7, 'APSNR Cb': 8, 'APSNR Cr':9,
             'MSSSIM':10, 'Encoding Time':11, 'VMAF_old':12, 'Decoding Time': 13,
             "PSNR Y (libvmaf)": 14, "PSNR Cb (libvmaf)": 15, "PSNR Cr (libvmaf)": 16,
             "CIEDE2000 (libvmaf)": 17, "SSIM (libvmaf)": 18, "MS-SSIM (libvmaf)": 19,
             "PSNR-HVS Y (libvmaf)": 20, "PSNR-HVS Cb (libvmaf)": 21, "PSNR-HVS Cr (libvmaf)": 22,
             "PSNR-HVS (libvmaf)": 23, "VMAF": 24, "VMAF-NEG": 25,
             "APSNR Y (libvmaf)": 26, "APSNR Cb (libvmaf)": 27, "APSNR Cr (libvmaf)": 28}

parser = argparse.ArgumentParser(description='Generate CTC CSV version of .out files')
parser.add_argument('run',nargs=1,help='Run folder')
args = parser.parse_args()

info_data = json.load(open(args.run[0]+'/info.json'))
task = info_data['task']
sets = json.load(open(os.path.join(os.getenv("CONFIG_DIR", "rd_tool"), "sets.json")))
videos = sets[task]["sources"]
videos_dir = os.path.join(os.getenv("MEDIA_DIR", "/mnt/runs/sets"), task) # for getting framerate

w = csv.writer(sys.stdout, dialect='excel')
w.writerow(['Video', 'QP', 'Bitrate (kbps)', 'PSNR Y', 'PSNR U', 'PSNR V',
            'SSIM', 'MS-SSIM', 'VMAF', 'nVMAF', 'PSNR-HVS Y', 'DE2K',
            'APSNR Y', 'APSNR U', 'APSNR V', 'Enc T [s]', 'Dec T [s]'])
for video in videos:
    v = open(os.path.join(videos_dir, video), 'rb')
    line = v.readline().decode('utf-8')
    fps_n, fps_d = re.search(r'F([0-9]*)\:([0-9]*)', line).group(1,2)
    width = re.search(r'W([0-9]*)', line).group(1)
    height = re.search(r'H([0-9]*)', line).group(1)
    a = loadtxt(os.path.join(args.run[0],task,video+'-daala.out'))
    for row in a:
        frames = int(row[1]) / int(width) / int(height)
        w.writerow([video,
                    row[0], #qp
                    int(row[2])*8.0*float(fps_n)/float(fps_d)/frames/1000.0,# bitrate
                    row[met_index['PSNR Y (libvmaf)']+3],
                    row[met_index['PSNR Cb (libvmaf)']+3],
                    row[met_index['PSNR Cr (libvmaf)']+3],
                    row[met_index['SSIM (libvmaf)']+3],
                    row[met_index['MS-SSIM (libvmaf)']+3],
                    row[met_index['VMAF']+3],
                    row[met_index['VMAF-NEG']+3],
                    row[met_index['PSNR-HVS Y (libvmaf)']+3],
                    row[met_index['CIEDE2000 (libvmaf)']+3],
                    row[met_index['APSNR Y (libvmaf)']+3],
                    row[met_index['APSNR Cb (libvmaf)']+3],
                    row[met_index['APSNR Cr (libvmaf)']+3],
                    row[met_index['Encoding Time']+3],
                    row[met_index['Decoding Time']+3],
                    ])
