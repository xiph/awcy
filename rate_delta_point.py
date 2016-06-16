#!/usr/bin/env python3

from numpy import *
from scipy import *
from scipy.interpolate import interp1d
from scipy.interpolate import pchip
import sys
import os
import argparse
import json

a = flipud(loadtxt(sys.argv[1]));
b = flipud(loadtxt(sys.argv[2]));

for m in range(0,11):
    try:
        ya = a[:,3+m]
        yb = b[:,3+m]
        ra = a[:,2]*8./a[:,1]
        rb = b[:,2]*8./b[:,1]
        a_rate = pchip(ya, log(ra))(float(sys.argv[3]))
        b_rate = pchip(yb, log(rb))(float(sys.argv[3]))
        print(exp(b_rate - a_rate) - 1)
    except IndexError:
        print('NaN')
