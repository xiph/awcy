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
from Config import LogLevels, ContentPath, Platform, Path_RDResults
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
    chart.set_size({'x_scale': 1.5, 'y_scale': 1.5})
    chart.set_chartarea({"fill": {'color': '#505050'}})
    chart.set_plotarea({"fill": {'color': '#505050'}})
    chart.set_legend({'position': 'bottom', 'font': {'color': 'white'}})
    return chart

def CreateChart_Line(wb, titlename, yaxis_name):
    chart = wb.add_chart({'type': 'line', 'name_font': {'size': 10.5}})
    chart.set_title({'name': titlename})
    chart.set_x_axis({'text_axis': True})
    chart.set_y_axis({'name': yaxis_name, 'name_font': {'size': 11}})
    chart.set_size({'x_scale': 1.4, 'y_scale': 1.5})
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
    height = 22
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
            m = re.search(r"POC:\s+(\d+)\s+\[( KEY |INTER)\]\[Q:\s*(\d+)\]:\s+(\d+)\s+Bytes,",line)
            if m:
                POC = m.group(1)
                frame_type = m.group(2)
                qindex = m.group(3)
                frame_size = m.group(4)
                if enc_list[int(POC)] == '':
                    enc_list[int(POC)] = "%s,%s,%s,%s"%(POC,frame_type,qindex,frame_size)

    for i in range(len(enc_list)):
        #"TestCfg,EncodeMethod,CodecName,EncodePreset,Class,Res,Name,FPS,BitDepth,QP,POC,TempLayerId,FrameType,qindex,FrameSize")
        perframe_csv.write("%s,%s,%s,%s,%s,%s,%s,%s,%d,%d,%s,%s\n"
                           %(test_cfg,EncodeMethod,CodecName,EncodePreset,clip.file_class,str(width)+"x"+str(height),
                             name,clip.fps,clip.bit_depth,qp,enc_list[i],perframe_vmaf_log[i]))