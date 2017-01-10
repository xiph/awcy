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
parser.add_argument('--format',help='Format of output',default='text')
args = parser.parse_args()

met_name = ['PSNR', 'PSNRHVS', 'SSIM', 'FASTSSIM', 'CIEDE2000', 'PSNR Cb', 'PSNR Cr', 'APSNR', 'APSNR Cb', 'APSNR Cr', 'MSSSIM', 'VMAF']
met_index = {'PSNR': 0, 'PSNRHVS': 1, 'SSIM': 2, 'FASTSSIM': 3, 'CIEDE2000': 4, 'PSNR Cb': 5, 'PSNR Cr': 6, 'APSNR': 7, 'APSNR Cb': 8, 'APSNR Cr':9, 'MSSSIM':10, 'VMAF':11}

q_not_found = False

def bdrate(file1, file2, anchorfile):
    if anchorfile:
        anchor = flipud(loadtxt(anchorfile));
    a = loadtxt(file1)
    b = loadtxt(file2)
    a = a[a[:,0].argsort()]
    b = b[b[:,0].argsort()]
    a = flipud(a)
    b = flipud(b)
    rates = [0.06,0.2];
    qa = a[:,0]
    qb = b[:,0]
    ra = a[:,2]*8./a[:,1]
    rb = b[:,2]*8./b[:,1]
    bdr = zeros((4,4))
    ret = {}
    for m in range(0,len(met_index)):
        try:
            ya = a[:,3+m];
            yb = b[:,3+m];
            if anchorfile:
                yr = anchor[:,3+m];
            #p0 = interp1d(ra, ya, interp_type)(rates[0]);
            #p1 = interp1d(ra, ya, interp_type)(rates[1]);
            if anchorfile:
                p0 = yr[0]
                p1 = yr[-1]
                yya = ya
                yyb = yb
                rra = ra
                rrb = rb
            else:
                minq = 20
                maxq = 55
                try:
                    # path if quantizers 20 and 55 are in set
                    minqa_index = qa.tolist().index(minq)
                    maxqa_index = qa.tolist().index(maxq)
                    minqb_index = qb.tolist().index(minq)
                    maxqb_index = qb.tolist().index(maxq)
                    yya = ya[maxqa_index:minqa_index+1]
                    yyb = yb[maxqb_index:minqb_index+1]
                    rra = ra[maxqa_index:minqa_index+1]
                    rrb = rb[maxqb_index:minqb_index+1]
                except ValueError:
                    # path if quantizers 20 and 55 are not found - use
                    # entire range of quantizers found, and fit curve
                    # on all the points, and set q_not_found to print
                    # a warning
                    q_not_found = True
                    minqa_index = -1
                    maxqa_index = 0
                    minqb_index = -1
                    maxqb_index = 0
                    yya = ya
                    yyb = yb
                    rra = ra
                    rrb = rb
                p0 = max(ya[maxqa_index],yb[maxqb_index])
                p1 = min(ya[minqa_index],yb[minqb_index])
            a_rate = pchip(yya, log(rra))(arange(p0,p1,abs(p1-p0)/5000.0));
            b_rate = pchip(yyb, log(rrb))(arange(p0,p1,abs(p1-p0)/5000.0));
            if not len(a_rate) or not len(b_rate):
                bdr = NaN;
            else:
                bdr=100 * (exp(mean(b_rate-a_rate))-1);
        except ValueError:
            bdr = NaN
        except linalg.linalg.LinAlgError:
            bdr = NaN
        except IndexError:
            bdr = NaN
        if abs(bdr) > 1000:
            bdr = NaN
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

if info_data and not args.overlap:
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

avg = {}
for m in range(0,len(met_index)):
    avg[m] = mean([metric_data[x][m] for x in metric_data])

categories = {}
if info_data:
    if 'categories' in sets[task]:
        for category_name in sets[task]['categories']:
            category = {}
            for m in range(0,len(met_index)):
                category[m] = mean([metric_data[x][m] for x in sets[task]['categories'][category_name]])
            categories[category_name] = category

if args.format == 'text':
    if q_not_found:
        print("Warning: Quantizers 20 and 55 not found in results, using maximum overlap")
    print("%10s: %9.2f%% %9.2f%% %9.2f%%" % ('PSNR YCbCr', avg[0], avg[5], avg[6]))
    print("%10s: %9.2f%%" % ('PSNRHVS', avg[1]))
    print("%10s: %9.2f%%" % ('SSIM', avg[2]))
    print("%10s: %9.2f%%" % ('MSSSIM', avg[10]))
    print("%10s: %9.2f%%" % ('CIEDE2000', avg[4]))
    print()
    print(('%'+str(filename_len)+"s ") % 'file', end='')
    for name in met_name:
        print("%9s " % name, end='')
    print('')
    print('------------------------------------------------------------------------------------------')
    for category_name in sorted(categories):
        metric = categories[category_name]
        print (('%'+str(filename_len)+"s ") % category_name[0:filename_len],end='')
        for met in met_name:
            print("%9.2f " % metric[met_index[met]],end='')
        print('')
    print('------------------------------------------------------------------------------------------')
    for video in sorted(metric_data):
        metric = metric_data[video]
        print (('%'+str(filename_len)+"s ") % video[0:filename_len],end='')
        for met in met_name:
            print("%9.2f " % metric[met_index[met]],end='')
        print('')
    print('------------------------------------------------------------------------------------------')
    print(('%'+str(filename_len)+"s ") % 'Average',end='')
    for met in met_name:
        print("%9.2f " % avg[met_index[met]],end='')
    print('')
    print("AWCY Report v0.4")
    if info_data:
        print('Reference: ' + info_data[0]['run_id'])
        print('Test Run: ' + info_data[1]['run_id'])
    if args.overlap:
        print('Range: overlap')
    elif info_data:
        print('Range: Anchor ' + info_data[2]['run_id'])
elif args.format == 'json':
    output = {}
    output['metric_names'] = met_name
    output['metric_data'] = metric_data
    output['average'] = avg
    output['categories'] = categories
    print(json.dumps(output,indent=2))
