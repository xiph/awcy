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
__author__ = "maggie.sun@intel.com, ryan.lei@intel.com, td@videolan.org"

import os
import sys
import xlsxwriter
import argparse
import numpy as np
import scipy.interpolate

from EncDecUpscale import Run_EncDec_Upscale, GetBsReconFileName
from VideoScaler import GetDownScaledOutFile, DownScaling
from CalculateQualityMetrics import CalculateQualityMetric, GatherQualityMetrics
from Utils import GetShortContentName, CreateChart_Scatter,\
     AddSeriesToChart_Scatter, InsertChartsToSheet, CreateNewSubfolder,\
     SetupLogging, UpdateChart, AddSeriesToChart_Scatter_Rows,\
     Cleanfolder, CreateClipList, Clip, GatherPerfInfo, GetEncLogFile, \
     GetRDResultCsvFile, GatherPerframeStat
from PostAnalysis_Summary import GenerateSumRDExcelFile,\
     GenerateSumCvxHullExcelFile
from ScalingTest import Run_Scaling_Test, SaveScalingResultsToExcel
import Utils
from operator import itemgetter
from Config import LogLevels, FrameNum, QPs, CvxH_WtCols,\
     CvxH_WtRows, QualityList, LineColors, SummaryOutPath, WorkPath, \
     Path_RDResults, DnScalingAlgos, UpScalingAlgos, ConvexHullColor, \
     EncodeMethods, CodecNames, LoggerName, DnScaleRatio, TargetQtyMetrics, \
     CvxHDataRows, CvxHDataStartRow, CvxHDataStartCol, CvxHDataNum, \
     Int_ConvexHullColor, EnablePreInterpolation
import ConvexHullTest
from ConvexHullTest import SaveConvexHullResultsToExcel

if __name__ == "__main__":
    global Function, KeepUpscaledOutput, SaveMemory, LogLevel, CodecName,\
        EncodeMethod, EncodePreset, LogCmdOnly
    parser = argparse.ArgumentParser(description='Produce convex hull bd-rate report')
    parser.add_argument('run',nargs=1,help='Run folders to compare')
    parser.add_argument('-l', "--LoggingLevel", dest='LogLevel', type=int,
                        default=3, choices=range(len(LogLevels)), metavar='',
                        help="logging level: 0:No Logging, 1: Critical, 2: Error,"
                             " 3: Warning, 4: Info, 5: Debug")
    args = parser.parse_args()
    LogCmdOnly = False
    Path_TestLog = args.run[0]

    SetupLogging(args.LogLevel, LogCmdOnly, LoggerName, Path_TestLog)
    clip_list = CreateClipList('AS')
    EncodeMethod = 'aom'
    ConvexHullTest.EncodeMethod = EncodeMethod
    CodecName = 'av1'
    ConvexHullTest.CodecName = CodecName
    test_cfg = 'AS'
    EncodePreset = 0
    ConvexHullTest.EncodePreset = EncodePreset
    ConvexHullTest.Path_Bitstreams = os.path.join(args.run[0], 'av2-a1-4k-as')
    ConvexHullTest.Path_QualityLog = ConvexHullTest.Path_Bitstreams
    ConvexHullTest.Path_PerfLog = ConvexHullTest.Path_Bitstreams
    ConvexHullTest.Path_RDResults = ConvexHullTest.Path_Bitstreams

    filename = "RDResults_%s_%s_%s_Preset_%s.csv" % \
               (EncodeMethod, CodecName, test_cfg, EncodePreset)
    csv_file = os.path.join(args.run[0], filename)
    filename = "Perframe_RDResults_%s_%s_%s_Preset_%s.csv" % \
               (EncodeMethod, CodecName, test_cfg, EncodePreset)
    perframe_csvfile  = os.path.join(args.run[0], filename)

    csv = open(csv_file, "wt")
    csv.write("TestCfg,EncodeMethod,CodecName,EncodePreset,Class,Res,Name,FPS," \
              "Bit Depth,QP,Bitrate(kbps)")
    for qty in QualityList:
        csv.write(',' + qty)
        csv.write(",EncT[s],DecT[s],EncT[h]\n")

    perframe_csv = open(perframe_csvfile, 'wt')
    perframe_csv.write("TestCfg,EncodeMethod,CodecName,EncodePreset,Class,Res,Name,FPS," \
                           "Bit Depth,QP,POC,FrameType,qindex,FrameSize")
    for qty in QualityList:
        if (qty != "Overall_PSNR" and qty != "Overall_APSNR" and not qty.startswith("APSNR")):
            perframe_csv.write(',' + qty)
            perframe_csv.write('\n')

    for clip in clip_list:
        SaveConvexHullResultsToExcel(clip, DnScalingAlgos, UpScalingAlgos, csv, perframe_csv,
                                     EnablePreInterpolation)
    csv.close()
    perframe_csv.close()
