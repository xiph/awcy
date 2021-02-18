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
import argparse
from CalculateQualityMetrics import CalculateQualityMetric, GatherQualityMetrics
from Utils import GetShortContentName, CreateNewSubfolder, SetupLogging, \
     Cleanfolder, CreateClipList, GetEncLogFile, GatherPerfInfo, GetEncPerfFile, \
     GetDecPerfFile, GetRDResultCsvFile, GatherPerframeStat
import Utils
from Config import LogLevels, FrameNum, TEST_CONFIGURATIONS, QPs, WorkPath, \
     Path_RDResults, LoggerName, QualityList, Platform, MIN_GOP_LENGTH
from EncDecUpscale import Encode, Decode

###############################################################################
##### Helper Functions ########################################################
def CleanIntermediateFiles():
    folders = [Path_DecodedYuv, Path_CfgFiles]
    for folder in folders:
        Cleanfolder(folder)

def GetBsReconFileName(EncodeMethod, CodecName, EncodePreset, test_cfg, clip, QP):
    basename = GetShortContentName(clip.file_name, False)
    filename = "%s_%s_%s_%s_Preset_%s_QP_%d.obu" % \
               (basename, EncodeMethod, CodecName, test_cfg, EncodePreset, QP)
    bs = os.path.join(Path_Bitstreams, filename)
    filename = "%s_%s_%s_%s_Preset_%s_QP_%d_Decoded.y4m" % \
               (basename, EncodeMethod, CodecName, test_cfg, EncodePreset, QP)
    dec = os.path.join(Path_DecodedYuv, filename)
    return bs, dec

def setupWorkFolderStructure():
    global Path_Bitstreams, Path_DecodedYuv, Path_QualityLog, Path_TestLog,\
           Path_CfgFiles, Path_TimingLog, Path_EncLog
    Path_Bitstreams = CreateNewSubfolder(WorkPath, "bistreams")
    Path_DecodedYuv = CreateNewSubfolder(WorkPath, "decodedYUVs")
    Path_QualityLog = CreateNewSubfolder(WorkPath, "qualityLogs")
    Path_TestLog = CreateNewSubfolder(WorkPath, "testLogs")
    Path_CfgFiles = CreateNewSubfolder(WorkPath, "configFiles")
    Path_TimingLog = CreateNewSubfolder(WorkPath, "perfLogs")
    Path_EncLog = CreateNewSubfolder(WorkPath, "encLogs")

###############################################################################
######### Major Functions #####################################################
def CleanUp_workfolders():
    folders = [Path_Bitstreams, Path_DecodedYuv, Path_QualityLog,
               Path_TestLog, Path_CfgFiles, Path_TimingLog, Path_EncLog]
    for folder in folders:
        Cleanfolder(folder)

def Run_Encode_Test(test_cfg, clip, preset, LogCmdOnly = False):
    Utils.Logger.info("start running %s encode tests with %s"
                      % (test_cfg, clip.file_name))
    for QP in QPs[test_cfg]:
        Utils.Logger.info("start encode with QP %d" % (QP))
        #encode
        if LogCmdOnly:
            Utils.CmdLogger.write("============== Job Start =================\n")
        bsFile = Encode('aom', 'av1', preset, clip, test_cfg, QP,
                        FrameNum[test_cfg], Path_Bitstreams, Path_TimingLog,
                        Path_EncLog, LogCmdOnly)
        Utils.Logger.info("start decode file %s" % os.path.basename(bsFile))
        #decode
        decodedYUV = Decode(test_cfg, 'av1', bsFile, Path_DecodedYuv, Path_TimingLog,
                            False, LogCmdOnly)
        #calcualte quality distortion
        Utils.Logger.info("start quality metric calculation")
        CalculateQualityMetric(clip.file_path, FrameNum[test_cfg], decodedYUV,
                               clip.fmt, clip.width, clip.height, clip.bit_depth,
                               Path_QualityLog, LogCmdOnly)
        if SaveMemory:
            Cleanfolder(Path_DecodedYuv)
        Utils.Logger.info("finish running encode with QP %d" % (QP))
        if LogCmdOnly:
            Utils.CmdLogger.write("============== Job End ===================\n\n")

#TODO: This function needs to be revised later
def GetTempLayerID(poc):
    temp_layer_id = 0; mod = poc % MIN_GOP_LENGTH
    if (mod == 0):
        temp_layer_id = 0
    elif (mod == 8):
        temp_layer_id = 1
    elif (mod == 4 or mod == 12):
        temp_layer_id = 2
    elif (mod == 2 or mod == 6 or mod == 10 or mod == 14):
        temp_layer_id = 3
    else:
        temp_layer_id = 5
    return temp_layer_id


def GenerateSummaryRDDataFile(EncodeMethod, CodecName, EncodePreset,
                              test_cfg, clip_list, log_path):
    Utils.Logger.info("start saving RD results to excel file.......")
    if not os.path.exists(Path_RDResults):
        os.makedirs(Path_RDResults)

    csv_file, perframe_csvfile = GetRDResultCsvFile(EncodeMethod, CodecName, EncodePreset, test_cfg)
    csv = open(csv_file, 'wt')
    csv.write("TestCfg,EncodeMethod,CodecName,EncodePreset,Class,Res,Name,FPS,"\
              "Bit Depth,QP,")
    if (test_cfg == "STILL"):
        csv.write("FileSize(bytes)")
    else:
        csv.write("Bitrate(kbps)")
    for qty in QualityList:
        csv.write(',' + qty)
    csv.write(",EncT[s],DecT[s],EncT[h]")
    csv.write('\n')

    perframe_csv = open(perframe_csvfile, 'wt')
    perframe_csv.write("TestCfg,EncodeMethod,CodecName,EncodePreset,Class,Res,Name,FPS," \
                       "Bit Depth,QP,POC,FrameType,qindex,FrameSize")
    for qty in QualityList:
        if (qty != "Overall_PSNR" and qty != "Overall_APSNR" and not qty.startswith("APSNR")):
            perframe_csv.write(',' + qty)
    perframe_csv.write('\n')

    for clip in clip_list:
        for qp in QPs[test_cfg]:
            bs, dec = GetBsReconFileName(EncodeMethod, CodecName, EncodePreset,
                                         test_cfg, clip, qp)
            filesize = os.path.getsize(bs)
            bitrate = (filesize * 8 * (clip.fps_num / clip.fps_denom)
                       / FrameNum[test_cfg]) / 1000.0
            quality, perframe_vmaf_log = GatherQualityMetrics(dec, Path_QualityLog)
            csv.write("%s,%s,%s,%s,%s,%s,%s,%.2f,%d,%d,"
                      %(test_cfg,EncodeMethod,CodecName,EncodePreset,clip.file_class,
                        str(clip.width)+'x'+str(clip.height), clip.file_name,
                        clip.fps,clip.bit_depth,qp))
            if (test_cfg == "STILL"):
                csv.write("%d"%filesize)
            else:
                csv.write("%.4f"%bitrate)

            for qty in quality:
                csv.write(",%.4f"%qty)
            enc_time, dec_time = GatherPerfInfo(bs, Path_TimingLog)
            enc_hour = (enc_time / 3600.0)
            csv.write(",%.2f,%.2f,%.2f,\n"%(enc_time,dec_time,enc_hour))
            if (EncodeMethod == 'aom'):
                enc_log = GetEncLogFile(bs, log_path)
                GatherPerframeStat(test_cfg,EncodeMethod,CodecName,EncodePreset,clip,clip.file_name, clip.width,
                                   clip.height, qp,enc_log,perframe_csv, perframe_vmaf_log)
    csv.close()
    perframe_csv.close()
    Utils.Logger.info("finish export RD results to file.")
    return

def ParseArguments(raw_args):
    parser = argparse.ArgumentParser(prog='AV2CTCTestTest.py',
                                     usage='%(prog)s [options]',
                                     description='')
    parser.add_argument('-f', '--function', dest='Function', type=str,
                        required=True, metavar='',
                        choices=["clean", "encode", "summary"],
                        help="function to run: clean, encode, summary")
    parser.add_argument('-s', "--SaveMemory", dest='SaveMemory', type=bool,
                        default=False, metavar='',
                        help="save memory mode will delete most files in"
                             " intermediate steps and keeps only necessary "
                             "ones for RD calculation. It is false by default")
    parser.add_argument('-CmdOnly', "--LogCmdOnly", dest='LogCmdOnly', type=bool,
                        default=False, metavar='',
                        help="LogCmdOnly mode will only capture the command sequences"
                             "It is false by default")
    parser.add_argument('-l', "--LoggingLevel", dest='LogLevel', type=int,
                        default=3, choices=range(len(LogLevels)), metavar='',
                        help="logging level: 0:No Logging, 1: Critical, 2: Error,"
                             " 3: Warning, 4: Info, 5: Debug")
    parser.add_argument('-p', "--EncodePreset", dest='EncodePreset', type=str,
                        metavar='', help="EncodePreset: 0,1,2... for aom")
    if len(raw_args) == 1:
        parser.print_help()
        sys.exit(1)
    args = parser.parse_args(raw_args[1:])

    global Function, SaveMemory, LogLevel, EncodePreset, LogCmdOnly
    Function = args.Function
    SaveMemory = args.SaveMemory
    LogLevel = args.LogLevel
    EncodePreset = args.EncodePreset
    LogCmdOnly = args.LogCmdOnly

######################################
# main
######################################
if __name__ == "__main__":
    #sys.argv = ["", "-f", "encode", "-p","1"]
    #sys.argv = ["", "-f", "summary", "-p","1"]
    ParseArguments(sys.argv)

    # preparation for executing functions
    setupWorkFolderStructure()
    if Function != 'clean':
        SetupLogging(LogLevel, LogCmdOnly, LoggerName, Path_TestLog)

    # execute functions
    if Function == 'clean':
        CleanUp_workfolders()
    elif Function == 'encode':
        for test_cfg in TEST_CONFIGURATIONS:
            clip_list = CreateClipList(test_cfg)
            for clip in clip_list:
                Run_Encode_Test(test_cfg, clip, EncodePreset, LogCmdOnly)
    elif Function == 'summary':
        for test_cfg in TEST_CONFIGURATIONS:
            clip_list = CreateClipList(test_cfg)
            GenerateSummaryRDDataFile('aom', 'av1', EncodePreset,
                                      test_cfg, clip_list, Path_EncLog)
        Utils.Logger.info("RD data summary file generated")
    else:
        Utils.Logger.error("invalid parameter value of Function")
