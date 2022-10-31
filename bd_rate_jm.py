#!/usr/bin/env python3

import sys

from numpy import *
from scipy import *
from scipy.interpolate import interp1d

a = genfromtxt(sys.argv[1])
b = genfromtxt(sys.argv[2])
rates = [0.005, 0.02, 0.06, 0.2]
ra = a[:, 2] * 8.0 / a[:, 1]
rb = b[:, 2] * 8.0 / b[:, 1]
interp_type = "cubic"
met_name = ["    PSNR", " PSNRHVS", "    SSIM", "FASTSSIM"]
print("          LOW (%%)\tMEDIUM (%%)\tHIGH (%%)")
bdr = zeros((4, 4))
for m in range(0, 4):
    ya = a[:, 3 + m]
    yb = b[:, 3 + m]
    for k in range(0, len(rates) - 1):
        try:
            p0 = interp1d(ra, ya, interp_type)(rates[k])
            p1 = interp1d(ra, ya, interp_type)(rates[k + 1])
        except ValueError:
            bdr[m, k] = NaN
            continue
        a_rate = interp1d(ya, log(ra), interp_type)(arange(p0, p1, 0.01))
        b_rate = interp1d(yb, log(rb), interp_type)(arange(p0, p1, 0.01))
        if not len(a_rate) or not len(b_rate):
            bdr[m, k] = NaN
        else:
            bdr[m, k] = 100 * (exp(mean(b_rate - a_rate)) - 1)
    print("%s\t%4f%%\t%4f%%\t%4f%%" % (met_name[m], bdr[m, 0], bdr[m, 1], bdr[m, 2]))
