#!/usr/bin/env python3

from __future__ import print_function

from numpy import *
import numpy as np
from scipy import *
from scipy.interpolate import interp1d
from scipy.interpolate import pchip
from scipy.interpolate import BPoly
from scipy._lib._util import _asarray_validated
import sys
import os
import argparse
import json

# The following implementations of pchip are copied from scipy.

"""
Copyright © 2001, 2002 Enthought, Inc.
All rights reserved.

Copyright © 2003-2019 SciPy Developers.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

    Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

    Neither the name of Enthought nor the names of the SciPy Developers may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
"""

class PchipInterpolator_new(BPoly):
    def __init__(self, x, y, axis=0, extrapolate=None):
        x = _asarray_validated(x, check_finite=False, as_inexact=True)
        y = _asarray_validated(y, check_finite=False, as_inexact=True)

        axis = axis % y.ndim

        xp = x.reshape((x.shape[0],) + (1,)*(y.ndim-1))
        yp = np.rollaxis(y, axis)

        dk = self._find_derivatives(xp, yp)
        data = np.hstack((yp[:, None, ...], dk[:, None, ...]))

        _b = BPoly.from_derivatives(x, data, orders=None)
        super(PchipInterpolator_new, self).__init__(_b.c, _b.x,
                                                extrapolate=extrapolate)
        self.axis = axis

    def roots(self):
        """
        Return the roots of the interpolated function.
        """
        return (PPoly.from_bernstein_basis(self._bpoly)).roots()

    @staticmethod
    def _edge_case(h0, h1, m0, m1):
        # one-sided three-point estimate for the derivative
        d = ((2*h0 + h1)*m0 - h0*m1) / (h0 + h1)

        # try to preserve shape
        mask = np.sign(d) != np.sign(m0)
        mask2 = (np.sign(m0) != np.sign(m1)) & (np.abs(d) > 3.*np.abs(m0))
        mmm = (~mask) & mask2

        d[mask] = 0.
        d[mmm] = 3.*m0[mmm]

        return d


    @staticmethod
    def _find_derivatives(x, y):
        # Determine the derivatives at the points y_k, d_k, by using
        #  PCHIP algorithm is:
        # We choose the derivatives at the point x_k by
        # Let m_k be the slope of the kth segment (between k and k+1)
        # If m_k=0 or m_{k-1}=0 or sgn(m_k) != sgn(m_{k-1}) then d_k == 0
        # else use weighted harmonic mean:
        #   w_1 = 2h_k + h_{k-1}, w_2 = h_k + 2h_{k-1}
        #   1/d_k = 1/(w_1 + w_2)*(w_1 / m_k + w_2 / m_{k-1})
        #   where h_k is the spacing between x_k and x_{k+1}
        y_shape = y.shape
        if y.ndim == 1:
            # So that _edge_case doesn't end up assigning to scalars
            x = x[:, None]
            y = y[:, None]

        hk = x[1:] - x[:-1]
        mk = (y[1:] - y[:-1]) / hk
        smk = np.sign(mk)
        condition = (smk[1:] != smk[:-1]) | (mk[1:] == 0) | (mk[:-1] == 0)

        w1 = 2*hk[1:] + hk[:-1]
        w2 = hk[1:] + 2*hk[:-1]

        # values where division by zero occurs will be excluded
        # by 'condition' afterwards
        with np.errstate(divide='ignore'):
            whmean = (w1/mk[:-1] + w2/mk[1:]) / (w1 + w2)

        dk = np.zeros_like(y)
        dk[1:-1][condition] = 0.0
        dk[1:-1][~condition] = 1.0 / whmean[~condition]

        # special case endpoints, as suggested in 
        # Cleve Moler, Numerical Computing with MATLAB, Chap 3.4
        dk[0] = PchipInterpolator_new._edge_case(hk[0], hk[1], mk[0], mk[1])
        dk[-1] = PchipInterpolator_new._edge_case(hk[-1], hk[-2], mk[-1], mk[-2])

        return dk.reshape(y_shape)

class PchipInterpolator_old(BPoly):
    def __init__(self, x, y, axis=0, extrapolate=None):
        x = _asarray_validated(x, check_finite=False, as_inexact=True)
        y = _asarray_validated(y, check_finite=False, as_inexact=True)

        axis = axis % y.ndim

        xp = x.reshape((x.shape[0],) + (1,)*(y.ndim-1))
        yp = np.rollaxis(y, axis)

        dk = self._find_derivatives(xp, yp)
        data = np.hstack((yp[:, None, ...], dk[:, None, ...]))

        _b = BPoly.from_derivatives(x, data, orders=None)
        super(PchipInterpolator_old, self).__init__(_b.c, _b.x,
                                                extrapolate=extrapolate)
        self.axis = axis

    def roots(self):
        """
        Return the roots of the interpolated function.
        """
        return (PPoly.from_bernstein_basis(self._bpoly)).roots()

    @staticmethod
    def _edge_case(m0, d1, out):
        m0 = np.atleast_1d(m0)
        d1 = np.atleast_1d(d1)
        mask = (d1 != 0) & (m0 != 0)
        out[mask] = 1.0/(1.0/m0[mask]+1.0/d1[mask])

    @staticmethod
    def _find_derivatives(x, y):
        # Determine the derivatives at the points y_k, d_k, by using
        #  PCHIP algorithm is:
        # We choose the derivatives at the point x_k by
        # Let m_k be the slope of the kth segment (between k and k+1)
        # If m_k=0 or m_{k-1}=0 or sgn(m_k) != sgn(m_{k-1}) then d_k == 0
        # else use weighted harmonic mean:
        #   w_1 = 2h_k + h_{k-1}, w_2 = h_k + 2h_{k-1}
        #   1/d_k = 1/(w_1 + w_2)*(w_1 / m_k + w_2 / m_{k-1})
        #   where h_k is the spacing between x_k and x_{k+1}
        y_shape = y.shape
        if y.ndim == 1:
            # So that _edge_case doesn't end up assigning to scalars
            x = x[:, None]
            y = y[:, None]

        hk = x[1:] - x[:-1]
        mk = (y[1:] - y[:-1]) / hk
        smk = np.sign(mk)
        condition = ((smk[1:] != smk[:-1]) | (mk[1:] == 0) | (mk[:-1] == 0))

        w1 = 2*hk[1:] + hk[:-1]
        w2 = hk[1:] + 2*hk[:-1]
        # values where division by zero occurs will be excluded
        # by 'condition' afterwards
        with np.errstate(divide='ignore'):
            whmean = 1.0/(w1+w2)*(w1/mk[1:] + w2/mk[:-1])
        dk = np.zeros_like(y)
        dk[1:-1][condition] = 0.0
        dk[1:-1][~condition] = 1.0/whmean[~condition]

        # For end-points choose d_0 so that 1/d_0 = 1/m_0 + 1/d_1 unless
        #  one of d_1 or m_0 is 0, then choose d_0 = 0
        PchipInterpolator_old._edge_case(mk[0], dk[1], dk[0])
        PchipInterpolator_old._edge_case(mk[-1], dk[-2], dk[-1])

        return dk.reshape(y_shape)


parser = argparse.ArgumentParser(description='Produce bd-rate report')
parser.add_argument('run',nargs=2,help='Run folders to compare')
parser.add_argument('--anchor',help='Explicit anchor to use')
parser.add_argument('--overlap',action='store_true',help='Use traditional overlap instead of anchor')
parser.add_argument('--anchordir',nargs=1,help='Folder to find anchor runs')
parser.add_argument('--suffix',help='Metric data suffix (default is .out)',default='.out')
parser.add_argument('--format',help='Format of output',default='text')
parser.add_argument('--fullrange',action='store_true',help='Use full range of QPs instead of 20-55')
parser.add_argument('--old-pchip',action='store_true')
args = parser.parse_args()

if args.old_pchip:
    pchip = PchipInterpolator_old
else:
    pchip = PchipInterpolator_new

met_name = ['PSNR', 'PSNRHVS', 'SSIM', 'FASTSSIM', 'CIEDE2000', 'PSNR Cb', 'PSNR Cr', 'APSNR', 'APSNR Cb', 'APSNR Cr', 'MSSSIM', 'Time', 'VMAF']
met_index = {'PSNR': 0, 'PSNRHVS': 1, 'SSIM': 2, 'FASTSSIM': 3, 'CIEDE2000': 4, 'PSNR Cb': 5, 'PSNR Cr': 6, 'APSNR': 7, 'APSNR Cb': 8, 'APSNR Cr':9, 'MSSSIM':10, 'Time':11, 'VMAF':12}

q_not_found = False

error_strings = []

def bdrate(file1, file2, anchorfile, fullrange):
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
                    if fullrange:
                        # bypass finding 20 and 55 and use the full range
                        raise ValueError
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
    print('Couldn\'t open', args.run[0])
    info_data = None

if info_data:
    sets = json.load(open(os.path.join(os.getenv("CONFIG_DIR", "rd_tool"), "sets.json")))
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
            metric_data[video] = bdrate(args.run[0]+'/'+task+'/'+video+args.suffix,args.run[1]+'/'+task+'/'+video+args.suffix,None,args.fullrange)
        else:
            metric_data[video] = bdrate(args.run[0]+'/'+task+'/'+video+args.suffix,args.run[1]+'/'+task+'/'+video+args.suffix,args.anchordir[0]+'/'+sets[task]['anchor']+'/'+task+'/'+video+args.suffix,args.fullrange)
else:
    for video in videos:
        metric_data[video] = bdrate(args.run[0]+'/'+video,args.run[1]+'/'+video,args.anchor+'/'+video,args.fullrange)

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

if q_not_found:
    error_strings.append("Warning: Quantizers 20 and 55 not found in results, using maximum overlap")

if args.format == 'text':
    for error in error_strings:
        print(error)
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
    output['error_strings'] = error_strings
    print(json.dumps(output,indent=2))
