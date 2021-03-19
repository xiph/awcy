#!/usr/bin/env python
## Copyright (c) 2019, Alliance for Open Media. All rights reserved
##
## This source code is subject to the terms of the BSD 2 Clause License and
## the Alliance for Open Media Patent License 1.0. If the BSD 2 Clause License
## was not distributed with this source code in the LICENSE file, you can
## obtain it at www.aomedia.org/license/software. If the Alliance for Open
## Media Patent License 1.0 was not distributed with this source code in the
## PATENTS file, you can obtain it at www.aomedia.org/license/patent.
##
__author__ = "maggie.sun@intel.com, ryan.lei@intel.com"

import os
import re
import sys
import subprocess
import time
import logging
import hashlib
import math
import numpy as np
import scipy.interpolate
import matplotlib.pyplot as plt
from operator import itemgetter
from Config import LogLevels, ContentPath, Platform, Path_RDResults, QPs
from AV2CTCVideo import Y4M_CLIPs, CTC_TEST_SET

class Clip:
    file_name = ""
    file_path = ""
    file_class = ""
    width = 0
    height = 0
    fmt = ""
    fps_num = 0
    fps_denom = 0
    fps = 0
    bit_depth = 0

    def __init__(self, Name="", Path = "", Class="", Width=0, Height=0, Fmt="", FPS_num=0, FPS_denom=0, Bit_depth=0):
        self.file_name = Name
        self.file_path = Path
        self.file_class = Class
        self.width = Width
        self.height = Height
        self.fmt = Fmt
        self.fps_num = FPS_num
        self.fps_denom = FPS_denom
        if (self.fps_num == 0):
            self.fps = 0
        else:
            self.fps = round(self.fps_num / self.fps_denom)
        self.bit_depth = Bit_depth

def Cleanfolder(folder):
    if os.path.isdir(folder):
        for f in os.listdir(folder):
            file = os.path.join(folder, f)
            if os.path.isfile(file):
                os.remove(file)

def CreateNewSubfolder(parent, name):
    if name == '' or name is None:
        return None
    folder = os.path.join(parent, name)
    if not os.path.exists(folder):
        os.makedirs(folder)
    return folder

def GetShortContentName(content, isshort=True):
    basename = os.path.splitext(os.path.basename(content))[0]
    if isshort:
        item = re.findall(r"([a-zA-Z0-9]+)_", basename)
        if len(item) == 0:
            name = basename
        else:
            name = item[0]
    else:
        name = basename
    return name

def GetEncLogFile(bsfile, logpath):
    filename = GetShortContentName(bsfile, False) + '_EncLog.txt'
    return os.path.join(logpath, filename)

def parseY4MHeader(y4m):
    """
    Parse y4m information from its header.
    """
    w = 0; h = 0; fps_num = 0; fps_denom = 0; fr = 0; fmt = "420"; bit_depth = 8;
    #print("parsing " + y4m)
    with open(y4m, 'rb') as f:
        line = f.readline().decode('utf-8')
        #YUV4MPEG2 W4096 H2160 F30000:1001 Ip A0:0 C420p10 XYSCSS=420P10
        m = re.search(r"W([0-9]+) H([0-9]+) F([0-9]+)\:([0-9]+)", line)
        if m:
            w = int(m.group(1))
            h = int(m.group(2))
            fps_num = float(m.group(3))
            fps_denom = float(m.group(4))
            fps = round(fps_num / fps_denom)
        m = re.search(r"C([0-9]+)p([0-9]+)", line)
        if m:
            fmt = m.group(1)
            bit_depth = int(m.group(2))
    if w == 0 or h == 0 or fps == 0:
        print("Failed to parse the input y4m file!\n")
        sys.exit()
    return (w, h, fps_num, fps_denom, fps, fmt, bit_depth)

def CreateClipList(test_cfg):
    clip_list = []; test_set = []
    #[filename, class, width, height, fps_num, fps_denom, bitdepth, fmt]
    test_set = CTC_TEST_SET[test_cfg]

    for cls in test_set:
        for file in Y4M_CLIPs[cls]:
            y4m = os.path.join(ContentPath, cls, file)
            w, h, fps_num, fps_denom, fps, fmt, bit_depth = parseY4MHeader(y4m)
            clip = Clip(file, y4m, cls, w, h, fmt, fps_num, fps_denom, bit_depth)
            clip_list.append(clip)
    return clip_list

def GetContentDict(clip_list):
    dict = {}
    for clip in clip_list:
        cls = clip.file_class
        file = clip.file_path
        if os.path.isfile(file):
            if cls in dict:
                if clip not in dict[cls]:
                    dict[cls].append(clip)
            else:
                dict[cls] = [clip]
    return dict

def CalcRowsClassAndContentDict(rowstart, clip_list, times=1):
    contentsdict = GetContentDict(clip_list)
    ofstc = rowstart
    rows_class = []
    for cls, clips in contentsdict.items():
        rows_class.append(ofstc)
        ofstc = ofstc + len(clips) * times
    return contentsdict, rows_class


def CreateChart_Scatter(wb, title, xaxis_name, yaxis_name):
    chart = wb.add_chart({'type': 'scatter', 'subtype': 'straight_with_markers'})
    chart.set_title({'name': title, 'name_font': {'color': 'white'}})
    chart.set_x_axis({'name': xaxis_name,
                      'major_gridlines': {'visible': True, 'line': {'width': 0.25}},
                      'name_font': {'color': 'white'},
                      'num_font': {'color': 'white', 'transparency': 80},
                      'label_position' : 'low'
                      })
    chart.set_y_axis({'name': yaxis_name, 'name_font': {'color': 'white'},
                      'num_font': {'color': 'white'}})
    chart.set_style(12)
    chart.set_size({'x_scale': 1.5, 'y_scale': 2.0})
    chart.set_chartarea({"fill": {'color': '#505050'}})
    chart.set_plotarea({"fill": {'color': '#505050'}})
    chart.set_legend({'position': 'bottom', 'font': {'color': 'white'}})
    return chart

def CreateChart_Line(wb, titlename, yaxis_name):
    chart = wb.add_chart({'type': 'line', 'name_font': {'size': 10.5}})
    chart.set_title({'name': titlename})
    chart.set_x_axis({'text_axis': True})
    chart.set_y_axis({'name': yaxis_name, 'name_font': {'size': 11}})
    chart.set_size({'x_scale': 1.5, 'y_scale': 2.0})
    chart.set_legend({'position': 'right', 'font': {'size': 10.5}})
    chart.set_high_low_lines(
        {'line': {'color': 'black', 'size': 2}}
    )
    return chart

def AddSeriesToChart_Scatter(shtname, rows, coly, colx, chart, seriname,
                             linecolor):
    yvalues = [shtname, rows[0], coly, rows[-1], coly]
    xvalues = [shtname, rows[0], colx, rows[-1], colx]

    chart.add_series({
        'name': seriname,
        'categories': xvalues,
        'values': yvalues,
        'line': {'color': linecolor, 'width': 1.5},
        'marker': {'type': 'circle', 'size': 5,
                   'border': {'color': linecolor, 'size': 0.75},
                   'fill': {'color': linecolor}},
    })

def AddSeriesToChart_Scatter_Rows(shtname, cols, rowy, rowx, chart, seriname,
                                  linecolor):
    yvalues = [shtname, rowy, cols[0], rowy, cols[-1]]
    xvalues = [shtname, rowx, cols[0], rowx, cols[-1]]

    chart.add_series({
        'name': seriname,
        'categories': xvalues,
        'values': yvalues,
        'line': {'color': linecolor, 'width': 1.0, 'dash_type': 'dash_dot'},
        'marker': {'type': 'square', 'size': 5,
                   'border': {'color': 'white', 'size': 0.75}}
    })

def AddSeriesToChart_Line(shtname, rows, coly, colx, chart, seriname, shape,
                          ssize, linecolor):
    yvalues = [shtname, rows[0], coly, rows[-1], coly]
    xvalues = [shtname, rows[0], colx, rows[-1], colx]
    chart.add_series({
        'name': seriname,
        'categories': xvalues,
        'values': yvalues,
        'line': {'none': True},
        'marker': {'type': shape,
                   'size': ssize,
                   'border': {'color': linecolor, 'size': 2},
                   'fill': {'color': linecolor}},
    })

def UpdateChart(chart, ymin, ymax, margin, yaxis_name, precsn):
    interval = ymax - ymin
    finalmax = ymax + interval * margin
    finalmin = ymin - interval * margin
    floatprecn = "{:.%df}" % precsn
    finalmin = float(floatprecn.format(finalmin))
    finalmax = float(floatprecn.format(finalmax))
    chart.set_y_axis({'name': yaxis_name,
                      'name_font': {'color': 'white'},
                      'num_font': {'color': 'white'},
                      'min': finalmin, 'max': finalmax})

def InsertChartsToSheet(sht, startrow, startcol, charts):
    height = 30
    width = 12
    num = len(charts)
    row = startrow
    for i in range(1, num, 2):
        sht.insert_chart(row, startcol, charts[i - 1])
        sht.insert_chart(row, startcol + width, charts[i])
        row = row + height

def ExecuteCmd(cmd, LogCmdOnly):
    CmdLogger.write(cmd + "\n")
    ret = 0
    if not LogCmdOnly:
        ret = subprocess.call(cmd, shell=True)
    return ret

def SetupLogging(level, logcmdonly, name, path):
    global Logger
    Logger = logging.getLogger(name)

    if logcmdonly or level != 0:
        global CmdLogger
        logfilename = os.path.join(path, '%s_TestCmd_%s.log'
                                   % (name, time.strftime("%Y%m%d-%H%M%S")))
        CmdLogger = open(logfilename, 'w')

    if level != 0:
        logfilename = os.path.join(path, '%s_Test_%s.log'
                                   % (name, time.strftime("%Y%m%d-%H%M%S")))
        hdlr = logging.FileHandler(logfilename)
        formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
        hdlr.setFormatter(formatter)
        Logger.addHandler(hdlr)
        if level in range(len(LogLevels)):
            # valid level input parameter
            lvl = LogLevels[level]
            levelname = logging.getLevelName(lvl)
        else:
            # if not valid, default set to 'INFO'
            levelname = logging.getLevelName('INFO')
        Logger.setLevel(levelname)

def md5(fname):
    hash_md5 = hashlib.md5()
    with open(fname, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def GatherInstrCycleInfo(bsfile, Path_TimingLog):
    assert(Platform != "Windows" and Platform != "Darwin")
    enc_perf = GetEncPerfFile(bsfile, Path_TimingLog)
    dec_perf = GetDecPerfFile(bsfile, Path_TimingLog)
    enc_instr = 0; enc_cycles = 0; dec_instr = 0; dec_cycles = 0
    flog = open(enc_perf, 'r')
    for line in flog:
        m = re.search(r"(\S+)\s+instructions", line)
        if m:
            enc_instr = int(m.group(1).replace(',', ''))
        m = re.search(r"(\S+)\s+cycles", line)
        if m:
            enc_cycles = int(m.group(1).replace(',', ''))
    flog.close()

    flog = open(dec_perf, 'r')
    for line in flog:
        m = re.search(r"(\S+)\s+instructions", line)
        if m:
            dec_instr = int(m.group(1).replace(',', ''))
        m = re.search(r"(\S+)\s+cycles", line)
        if m:
            dec_cycles = int(m.group(1).replace(',', ''))
    flog.close()
    return enc_instr, enc_cycles, dec_instr, dec_cycles

def GatherPerfInfo(bsfile, Path_TimingLog):
    enc_perf = GetEncPerfFile(bsfile, Path_TimingLog)
    dec_perf = GetDecPerfFile(bsfile, Path_TimingLog)
    enc_time = 0.0; dec_time = 0.0
    flog = open(enc_perf, 'r')
    for line in flog:
        if Platform == "Windows":
            m = re.search(r"Execution time:\s+(\d+\.?\d*)", line)
        else:
            m = re.search(r"User time \(seconds\):\s+(\d+\.?\d*)", line)
        if m:
            enc_time = float(m.group(1))
    flog.close()

    flog = open(dec_perf, 'r')
    for line in flog:
        if Platform == "Windows":
            m = re.search(r"Execution time:\s+(\d+\.?\d*)", line)
        else:
            m = re.search(r"User time \(seconds\):\s+(\d+\.?\d*)", line)
        if m:
            dec_time = float(m.group(1))
    flog.close()
    return enc_time, dec_time

def GetEncPerfFile(bsfile, perfpath):
    filename = GetShortContentName(bsfile, False) + '_EncTime.txt'
    return os.path.join(perfpath, filename)

def GetDecPerfFile(bsfile, perfpath):
    filename = GetShortContentName(bsfile, False) + '_DecTime.txt'
    return os.path.join(perfpath, filename)

def GetRDResultCsvFile(EncodeMethod, CodecName, EncodePreset, test_cfg):
    filename = "RDResults_%s_%s_%s_Preset_%s.csv" % \
               (EncodeMethod, CodecName, test_cfg, EncodePreset)
    avg_file = os.path.join(Path_RDResults, filename)
    filename = "Perframe_RDResults_%s_%s_%s_Preset_%s.csv" % \
               (EncodeMethod, CodecName, test_cfg, EncodePreset)
    perframe_data = os.path.join(Path_RDResults, filename)
    return avg_file, perframe_data


def GatherPerframeStat(test_cfg,EncodeMethod,CodecName,EncodePreset,clip, name, width, height,
                       qp,enc_log,perframe_csv,perframe_vmaf_log):
    enc_list = [''] * len(perframe_vmaf_log)
    flog = open(enc_log, 'r')

    for line in flog:
        if line.startswith("POC"):
            #POC:     0 [ KEY ][Q:143]:      40272 Bytes, 1282.9ms, 36.5632 dB(Y), 45.1323 dB(U), 46.6284 dB(V), 38.0736 dB(Avg)    [  0,  0,  0,  0,  0,  0,  0,]
            m = re.search(r"POC:\s+(\d+)\s+\[( KEY |INTER)\]\[Level:(\d+)\]\[Q:\s*(\d+)\]:\s+(\d+)\s+Bytes,",line)
            if m:
                POC = m.group(1)
                frame_type = m.group(2)
                pyd_level = m.group(3)
                qindex = m.group(4)
                frame_size = m.group(5)
                if enc_list[int(POC)] == '':
                    enc_list[int(POC)] = "%s,%s,%s,%s,%s"%(POC,frame_type,pyd_level,qindex,frame_size)

    for i in range(len(enc_list)):
        #"TestCfg,EncodeMethod,CodecName,EncodePreset,Class,Res,Name,FPS,BitDepth,QP,POC,FrameType,PydLevel,qindex,FrameSize")
        perframe_csv.write("%s,%s,%s,%s,%s,%s,%s,%s,%d,%d,%s,%s\n"
                           %(test_cfg,EncodeMethod,CodecName,EncodePreset,clip.file_class,str(clip.width)+"x"+str(clip.height),
                             name,clip.fps,clip.bit_depth,qp,enc_list[i],perframe_vmaf_log[i]))


def plot_rd_curve(br, qty, qty_str, name, line_color=None, line_style=None, marker_format=None):
    # generate samples between max and min of quality metrics
    '''
    brqtypairs = []
    for i in range(min(len(qty), len(br))):
        brqtypairs.append((br[i], qty[i]))
    brqtypairs.sort(key = itemgetter(0, 1))
    new_br = [brqtypairs[i][0] for i in range(len(brqtypairs))]
    new_qty = [brqtypairs[i][1] for i in range(len(brqtypairs))]
    min_br = min(new_br)
    max_br = max(new_br)
    lin = np.linspace(min_br, max_br, num=100, retstep=True)
    samples = lin[0]
    v = scipy.interpolate.pchip_interpolate(new_br, new_qty, samples)
    plt.plot(samples, v, linestyle=line_style, color=line_color)
    plt.scatter(new_br, new_qty, color=line_color, marker=marker_format)
    '''
    plt.plot(br, qty, linestyle=line_style, color=line_color)
    plt.scatter(br, qty, color=line_color, marker=marker_format, label=name)
    plt.xlabel('bdrate(Kbps)')
    plt.ylabel(qty_str)

def Interpolate_Bilinear(RDPoints, QPs, logBr=True):
    '''
    generate interpolated points on a RD curve.
    input is list of existing RD points as (bitrate, quality) tuple
    total number of interpolated points depends on the min and max QP
    '''
    # sort the pair based on bitrate in decreasing order
    # if bitrate is the same, then sort based on quality in increasing order
    RDPoints.sort(key=itemgetter(0, 1), reverse=True)
    # sort QPs in decreasing order
    #QPs.sort(reverse=True)
    int_points = []

    for i in range(1, len(QPs)):
        # generate samples for each segement
        br = [RDPoints[i - 1][0], RDPoints[i][0]]
        qty = [RDPoints[i - 1][1], RDPoints[i][1]]
        if logBr:
            br = [math.log10(br[i]) for i in range(len(br))]

        addPoints = (QPs[i] - QPs[i-1])
        # slope is negative
        qty_slope = (qty[1] - qty[0]) / addPoints
        br_slope = (br[1] - br[0]) / addPoints
        for j in range(0, addPoints):
            int_br = br[0] + j * br_slope
            int_br = pow(10, int_br)
            int_qty = qty[0] + j * qty_slope
            int_points += [(int_br, int_qty)]

    # add the last rd points from the input
    int_points += [(RDPoints[-1][0], RDPoints[-1][1])]

    '''
    print("before interpolation:")
    for i in range(len(RDPoints)):
        print("%f, %f"%(RDPoints[i][0], RDPoints[i][1]))
    print("after interpolation:")
    for i in range(len(int_points)):
        print("%f, %f"%(int_points[i][0], int_points[i][1]))
    '''
    return int_points

def Interpolate_PCHIP(RDPoints, QPs):
    '''
    generate interpolated points on a RD curve.
    input is list of existing RD points as (bitrate, quality) tuple
    total number of interpolated points depends on the min and max QP
    this version interpolate over the bitrate and quality range piece by
    piece, so all input RD data points are guaranteed in the output
    '''
    # sort the pair based on bitrate in increasing order
    # if bitrate is the same, then sort based on quality in increasing order
    RDPoints.sort(key = itemgetter(0, 1))
    br = [RDPoints[i][0] for i in range(len(RDPoints))]
    qty = [RDPoints[i][1] for i in range(len(RDPoints))]
    # sort QPs in decreasing order
    QPs.sort(reverse=True)
    int_points = []

    for i in range(1, len(QPs)):
        # generate samples between max and min of quality metrics
        max_qp = QPs[i - 1]; min_qp = QPs[i]
        lin = np.linspace(br[i-1], br[i], num = (max_qp - min_qp + 1), retstep = True)
        int_br = lin[0]

        # interpolation using pchip
        int_qty = scipy.interpolate.pchip_interpolate(br, qty, int_br)
        int_points += [(int_br[i], int_qty[i]) for i in range(len(int_br) - 1)]

    # add the last rd points from the input
    int_points += [(br[-1], qty[-1])]
    '''
    print("before interpolation:")
    for i in range(len(br)):
        print("%f, %f"%(br[i], qty[i]))
    print("after interpolation:")
    for i in range(len(int_points)):
        print("%f, %f"%(int_points[i][0], int_points[i][1]))

    result = all(elem in int_points for elem in RDPoints)
    if result:
        print("Yes, Interpolation contains all elements in the input")
    else:
        print("No, Interpolation does not contain all elements in the input")
    '''
    return int_points


'''
The convex_hull function is adapted based on the original python implementation
from https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain
It is changed to return the lower and upper portions of the convex hull separately
to get the convex hull based on traditional rd curve, only the upper portion is
needed.
'''

def convex_hull(points):
    """Computes the convex hull of a set of 2D points.
    Input: an iterable sequence of (x, y) pairs representing the points.
    Output: a list of vertices of the convex hull in counter-clockwise order,
      starting from the vertex with the lexicographically smallest coordinates.
    Implements Andrew's monotone chain algorithm. O(n log n) complexity.
    """

    # Sort the points lexicographically (tuples are compared lexicographically).
    # Remove duplicates to detect the case we have just one unique point.
    points = sorted(set(points))

    # Boring case: no points or a single point, possibly repeated multiple times.
    if len(points) <= 1:
        return points

    # 2D cross product of OA and OB vectors, i.e. z-component of their 3D cross
    # product. Returns a positive value, if OAB makes a counter-clockwise turn,
    # negative for clockwise turn, and zero if the points are collinear.
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    # Build lower hull
    lower = []
    for p in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    # Build upper hull
    upper = []
    for p in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower, upper

'''
######################################
# main
######################################
if __name__ == "__main__":

    reslutions = ["2160p","1440p","1080p","720p","540p","360p"]

    rdpoints = {
        "2160p" :[(37547.9659,43.9085),(19152.0922,42.5703),(9291.0302,41.048),
                  (4623.8611,39.3547),(2317.0762,37.4839),(1010.1394,35.2487)],
        "1440p" :[(19569.5627,42.2546),(10333.8803,41.05),(5206.9764,39.5806),
                  (2615.9834,37.8888),(1298.0177,36.0098),(562.8501,33.8222)],
        "1080p" :[(12487.7129,40.6077),(6690.0226,39.5905),(3427.771,38.2816),
                  (1724.92,36.701),(847.6557,34.9042),(369.607,32.8162)],
        "720p"  :[(6202.9626,37.2784),(3414.0641,36.6894),(1812.6317,35.8205),
                  (934.1797,34.6135),(457.374,33.0808),(203.929,31.2627)],
        "540p"  :[(3648.3578,34.7304),(2053.9891,34.375),(1121.7496,33.8025),
                  (590.8836,32.9133),(291.6739,31.6711),(135.4018,30.1146)],
        "360p"  :[(1677.5655,32.0908),(984.1863,31.8834),(554.9822,31.5193),
                  (299.4827,30.8819),(152.3105,29.9195),(76.5757,28.6167)],
    }
    formats = {
        "2160p": ['r', '-', 'o'],
        "1440p": ['b', '-', '+'],
        "1080p": ['g', '-', '*'],
        "720p" : ['c', '-', '.'],
        "540p" : ['r', '-', '^'],
        "360p" : ['b', '-', '<'],
    }
    #plt.figure(figsize=(15, 10))

    print("Before Interpolation:")
    for res in reslutions:
        br   = [rdpoints[res][i][0] for i in range(len(rdpoints[res]))]
        psnr = [rdpoints[res][i][1] for i in range(len(rdpoints[res]))]
        plot_rd_curve(br, psnr, "psnr_y", res, formats[res][0],formats[res][1],formats[res][2])

    plt.legend()
    plt.grid(True)
    plt.show()

    print("Bilinear:")
    int_rdpoints = {}
    Int_RDPoints = []
    NumPoints = 0
    plt.figure(figsize=(15, 10))

    for res in reslutions:
        rdpnts = [(rdpoints[res][i][0], rdpoints[res][i][1]) for i in range(len(rdpoints[res]))]
        int_rdpnts = Interpolate_Bilinear(rdpoints[res], QPs['AS'][:])
        NumPoints += len(int_rdpnts)
        # print(rdpnts)
        # print(int_rdpnts)
        result = all(elem in int_rdpnts for elem in rdpnts)
        if result:
            print("Yes, Interpolation contains all elements in the input")
        else:
            print("No, Interpolation does not contain all elements in the input")
        int_rdpoints[res] = int_rdpnts
        Int_RDPoints += int_rdpnts
        br = [int_rdpoints[res][i][0] for i in range(len(int_rdpoints[res]))]
        psnr = [int_rdpoints[res][i][1] for i in range(len(int_rdpoints[res]))]
        plot_rd_curve(br, psnr, "psnr_y", res, formats[res][0], formats[res][1], formats[res][2])

    print("Number of Interpolated points = %d" % NumPoints)

    plt.legend()
    plt.grid(True)
    plt.show()

    print("Convex Hull:")
    lower, upper = convex_hull(Int_RDPoints)
    br    = [upper[i][0] for i in range(len(upper))]
    psnr  = [upper[i][1] for i in range(len(upper))]
    print("Number of Convex Hull points = %d"%len(upper))
    print(upper)

    plt.figure(figsize=(15, 10))
    plot_rd_curve(br, psnr, "psnr_y", 'convex-hull', 'b', '-', '*')
    plt.legend()
    plt.grid(True)
    plt.show()
'''