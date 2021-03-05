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
import subprocess
import xlrd
import re

parser = argparse.ArgumentParser(description='Dump convex hull')
parser.add_argument('xls',nargs=1,help='xls file to dump')
args = parser.parse_args()

met_index_as = {"PSNR Y (libvmaf)": 11, "PSNR Cb (libvmaf)": 18, "PSNR Cr (libvmaf)": 25,
             "CIEDE2000 (libvmaf)": 74, "SSIM (libvmaf)": 39, "MS-SSIM (libvmaf)": 46,
                "PSNR-HVS (libvmaf)": 67, "VMAF": 53, "VMAF-NEG": 60}

resolutions = ['3840x2160', '2560x1440', '1920x1080', '1280x720', '960x540', '640x360']

error_strings = []

def dump_as(file1):
    ret = {}
    a_xls = xlrd.open_workbook(file1)
    a_sh = a_xls.sheet_by_index(0)
    for metric in met_index_as:
        if metric  not in met_index_as:
            return
        ra = []
        ya = []
        for c in range(1,a_sh.ncols):
            y = a_sh.cell_value(colx=c, rowx=met_index_as[metric] - 1 + 4)
            if (y == ''):
                continue
            ya.append(y)
            ra.append(a_sh.cell_value(colx=c, rowx=met_index_as[metric] - 1 + 5))
        ra = np.flipud(ra)
        ya = np.flipud(ya)
        ret[metric] = {"Bitrate": ra.tolist(), "Metric": ya.tolist()}
    return ret

# generate xls for each of the two runs:
#or run in args.run:
#   subprocess.run(['python3', 'convexhull_framework/src/AWCYConvexHullTest.py', run], check=True)

ret = dump_as(args.xls[0])
print(json.dumps(ret))
