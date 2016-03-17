#!/usr/bin/env python3

from numpy import *
from scipy import *
from scipy.interpolate import interp1d
import sys
import argparse
import json

parser = argparse.ArgumentParser(description='Produce bd-rate report')
parser.add_argument('run',nargs=2,help='Run folders to compare')
args = parser.parse_args()

met_name = ['PSNR', 'PSNRHVS', 'SSIM', 'FASTSSIM'];

def bdrate(file1, file2):
    a = flipud(loadtxt(file1));
    b = flipud(loadtxt(file2));
    rates = [0.06,0.2];
    ra = a[:,2]*8./a[:,1]
    rb = b[:,2]*8./b[:,1];
    interp_type = 'cubic';
    bdr = zeros((4,4))
    ret = {}
    for m in range(0,4):
        ya = a[:,3+m];
        yb = b[:,3+m];
        try:
            p0 = interp1d(ra, ya, interp_type)(rates[0]);
            p1 = interp1d(ra, ya, interp_type)(rates[1]);
            a_rate = interp1d(ya, log(ra), interp_type)(arange(p0,p1,0.01));
            b_rate = interp1d(yb, log(rb), interp_type)(arange(p0,p1,0.01));
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


info_data = {}
info_data[0] = json.load(open(args.run[0]+'/info.json'))
info_data[1] = json.load(open(args.run[1]+'/info.json'))

if info_data[0]['task'] != info_data[1]['task']:
    print("Runs do not match.")
    sys.exit(1)

task = info_data[0]['task']

sets = json.load(open("rd_tool/sets.json"))
videos = sets[task]["sources"]

metric_data = {}
for video in videos:
    metric_data[video] = bdrate(args.run[0]+'/'+task+'/'+video+'-daala.out',args.run[1]+'/'+task+'/'+video+'-daala.out')

print("AWCY Report v0.1")
print('Reference: ' + info_data[0]['run_id'])
print('Test Run: ' + info_data[1]['run_id'])
print("%40s %8s %8s %8s %8s" % ('file','PSNR','SSIM','PSNRHVS','FASTSSIM'))
print('-----------------------------------------------------------------------------')
for video in metric_data:
    metric = metric_data[video]
    print("%40s %8.2f %8.2f %8.2f %8.2f" % (video, metric[0], metric[1], metric[2], metric[3]))
print('-----------------------------------------------------------------------------')
avg = {}
for m in range(0,4):
    avg[m] = mean([metric_data[x][m] for x in metric_data])
print("%40s %8.2f %8.2f %8.2f %8.2f" % ('Average', avg[0], avg[1], avg[2], avg[3]))
