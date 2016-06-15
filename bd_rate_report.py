#!/usr/bin/env python3

from numpy import *
from scipy import *
from scipy.interpolate import interp1d
from scipy.interpolate import pchip
import sys
import os
import argparse
import json

parser = argparse.ArgumentParser(description='Produce bd-rate report')
parser.add_argument('run',nargs=2,help='Run folders to compare')
parser.add_argument('--anchor',help='Explicit anchor to use')
parser.add_argument('--overlap',action='store_true',help='Use traditional overlap instead of anchor')
parser.add_argument('--anchordir',nargs=1,help='Folder to find anchor runs')
parser.add_argument('--suffix',help='Metric data suffix (default is .out)',default='.out')
args = parser.parse_args()

met_name = ['PSNR', 'PSNRHVS', 'SSIM', 'FASTSSIM', 'CIEDE2000', 'PSNR Cb', 'PSNR Cr', 'APSNR', 'APSNR Cb', 'APSNR Cr', 'MSSSIM'];

def bdrate(file1, file2, anchorfile):
    if anchorfile:
        anchor = flipud(loadtxt(anchorfile));
    a = flipud(loadtxt(file1));
    b = flipud(loadtxt(file2));
    rates = [0.06,0.2];
    q = a[:0]
    ra = a[:,2]*8./a[:,1]
    rb = b[:,2]*8./b[:,1]
    bdr = zeros((4,4))
    ret = {}
    for m in range(0,len(met_name)):
        ya = a[:,3+m];
        yb = b[:,3+m];
        if anchorfile:
            yr = anchor[:,3+m];
        try:
            #p0 = interp1d(ra, ya, interp_type)(rates[0]);
            #p1 = interp1d(ra, ya, interp_type)(rates[1]);
            if anchorfile:
                p0 = yr[0]
                p1 = yr[-1]
            else:
                minq = 20
                maxq = 55
                try:
                    minq_index = q.index(minq)
                    maxq_index = q.index(maxq)
                except ValueError:
                    print('Q bound not in results')
                p0 = max(ya[minq_index],yb[maxq_index])
                p1 = min(ya[minq_index],yb[maxq_index])
            a_rate = pchip(ya, log(ra))(arange(p0,p1,abs(p1-p0)/5000.0));
            b_rate = pchip(yb, log(rb))(arange(p0,p1,abs(p1-p0)/5000.0));
            if not len(a_rate) or not len(b_rate):
                bdr = NaN;
            else:
                bdr=100 * (exp(mean(b_rate-a_rate))-1);
        except ValueError:
            bdr = NaN;
        except linalg.linalg.LinAlgError:
            bdr = NaN;
        ret[m] = bdr
    return ret

metric_data = {}

try:
    info_data = {}
    info_data[0] = json.load(open(args.run[0]+'/info.json'))
    info_data[1] = json.load(open(args.run[1]+'/info.json'))

    if info_data[0]['task'] != info_data[1]['task']:
        print("Runs do not match.")
        sys.exit(1)
    task = info_data[0]['task']
except FileNotFoundError:
    # no info.json, using bare directories
    info_data = None

if info_data:
    sets = json.load(open("rd_tool/sets.json"))
    videos = sets[task]["sources"]
else:
    if not args.anchor and not args.overlap:
        print("You must specify an anchor to use if comparing bare result directories.")
        exit(1)
    videos = os.listdir(args.anchor)

if info_data:
    info_data[2] = json.load(open(args.anchordir[0]+'/'+sets[task]['anchor']+'/info.json'))
    if info_data[2]['task'] != info_data[0]['task']:
        print("Mismatched anchor data!")
        sys.exit(1)

if info_data:
    for video in videos:
        if args.overlap:
            metric_data[video] = bdrate(args.run[0]+'/'+task+'/'+video+args.suffix,args.run[1]+'/'+task+'/'+video+args.suffix,None)
        else:
            metric_data[video] = bdrate(args.run[0]+'/'+task+'/'+video+args.suffix,args.run[1]+'/'+task+'/'+video+args.suffix,args.anchordir[0]+'/'+sets[task]['anchor']+'/'+task+'/'+video+args.suffix)
else:
    for video in videos:
        metric_data[video] = bdrate(args.run[0]+'/'+video,args.run[1]+'/'+video,args.anchor+'/'+video)

filename_len = 40
for video in videos:
    if filename_len < len(video):
        filename_len = len(video)
print("AWCY Report v0.4")
if info_data:
    print('Reference: ' + info_data[0]['run_id'])
    print('Test Run: ' + info_data[1]['run_id'])
if args.overlap:
    print('Range: overlap')
elif info_data:
    print('Range: Anchor ' + info_data[2]['run_id'])
avg = {}
for m in range(0,len(met_name)):
    avg[m] = mean([metric_data[x][m] for x in metric_data])
    print("%10s: %9.2f" % (met_name[m], avg[m]))
print()
print(('%'+str(filename_len)+"s ") % 'file', end='')
for name in met_name:
    print("%9s " % name, end='')
print('')
print('------------------------------------------------------------------------------------------')
for video in sorted(metric_data):
    metric = metric_data[video]
    print (('%'+str(filename_len)+"s ") % video,end='')
    for i in range(0,len(met_name)):
        print("%9.2f" % metric[i],end='')
    print('')
print('------------------------------------------------------------------------------------------')
print(('%'+str(filename_len)+"s ") % 'Average',end='')
for i in range(0,len(met_name)):
    print("%9.2f" % avg[i],end='')
print('')
