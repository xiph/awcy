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
import Utils
import logging
import fileinput
from shutil import copyfile
from Config import LoggerName, FFMPEG, HDRToolsConfigFileTemplate, HDRConvert, Platform, \
    ContentPath
from Utils import GetShortContentName, ExecuteCmd, md5
from AV2CTCVideo import AS_Downscaled_Clips

subloggername = "VideoScaler"
loggername = LoggerName + '.' + '%s' % subloggername
logger = logging.getLogger(loggername)

def GenerateCfgFile(clip, outw, outh, algo, outfile, num, configpath):
    contentBaseName = GetShortContentName(clip.file_name, False)
    cfg_filename = contentBaseName + ('_Scaled_%s_%dx%d.cfg'% (algo, outw, outh))
    fmt = 1
    if (clip.fmt == '400'):
        fmt = 0
    elif (clip.fmt == '420'):
        fmt = 1
    elif (clip.fmt == '422'):
        fmt = 2
    elif (clip.fmt == '444'):
        fmt = 3

    fps = 0
    if (clip.fps_num == 0):
        fps = 0
    else:
        fps = (float)(clip.fps_num / clip.fps_denom)

    cfgfile = os.path.join(configpath, cfg_filename)
    copyfile(HDRToolsConfigFileTemplate, cfgfile)
    fp = fileinput.input(cfgfile, inplace=1)
    for line in fp:
        if 'SourceFile=' in line:
            line = 'SourceFile="%s"\n' % clip.file_path
        if 'OutputFile=' in line:
            line = 'OutputFile="%s"\n' % outfile
        if 'SourceWidth=' in line:
            line = 'SourceWidth=%d\n' % clip.width
        if 'SourceHeight=' in line:
            line = 'SourceHeight=%d\n' % clip.height
        if 'OutputWidth=' in line:
            line = 'OutputWidth=%d\n' % outw
        if 'OutputHeight=' in line:
            line = 'OutputHeight=%d\n' % outh
        if 'SourceRate=' in line:
            line = 'SourceRate=%4.3f\n' % fps
        if 'SourceChromaFormat=' in line:
            line = 'SourceChromaFormat=%d\n' % fmt
        if 'SourceBitDepthCmp0=' in line:
            line = 'SourceBitDepthCmp0=%d\n' % clip.bit_depth
        if 'SourceBitDepthCmp1=' in line:
            line = 'SourceBitDepthCmp1=%d\n' % clip.bit_depth
        if 'SourceBitDepthCmp2=' in line:
            line = 'SourceBitDepthCmp2=%d\n' % clip.bit_depth
        if 'OutputRate=' in line:
            line = 'OutputRate=%4.3f\n' % fps
        if 'OutputChromaFormat=' in line:
            line = 'OutputChromaFormat=%d\n' % fmt
        if 'OutputBitDepthCmp0=' in line:
            line = 'OutputBitDepthCmp0=%d\n' % clip.bit_depth
        if 'OutputBitDepthCmp1=' in line:
            line = 'OutputBitDepthCmp1=%d\n' % clip.bit_depth
        if 'OutputBitDepthCmp2=' in line:
            line = 'OutputBitDepthCmp2=%d\n' % clip.bit_depth
        if 'NumberOfFrames=' in line:
            line = 'NumberOfFrames=%d\n' % num
        print(line, end='')
    fp.close()
    return cfgfile

def RescaleWithHDRTool(clip, outw, outh, algo, outfile, num, cfg_path,
                       LogCmdOnly = False):
    cfg_file = GenerateCfgFile(clip, outw, outh, algo, outfile, num, cfg_path)
    args = " -f %s" % cfg_file
    cmd = HDRConvert + args
    ExecuteCmd(cmd, LogCmdOnly)

def VideoRescaling(clip, num, outw, outh, outfile, algo, cfg_path,
                   LogCmdOnly = False):
    RescaleWithHDRTool(clip, outw, outh, algo, outfile, num, cfg_path, LogCmdOnly)
    # add other tools for scaling here later

####################################################################################
##################### Major Functions ################################################
def GetDownScaledOutFile(clip, dnw, dnh, path, algo, ds_on_the_fly=True, ratio_idx=0):
    contentBaseName = GetShortContentName(clip.file_name, False)
    dnscaledout = clip.file_path
    if clip.width != dnw or clip.height != dnh:
        if ds_on_the_fly:
            filename = contentBaseName + ('_Scaled_%s_%dx%d.y4m' % (algo, dnw, dnh))
            dnscaledout = os.path.join(path, filename)
        else:
            dnscaledout = ContentPath + "/A1_downscaled/" + \
                          AS_Downscaled_Clips[contentBaseName][ratio_idx-1]

    return dnscaledout

def GetUpScaledOutFile(clip, outw, outh, algo, path):
    contentBaseName = GetShortContentName(clip.file_name, False)
    upscaledout = clip.file_path
    if clip.width != outw or clip.height != outh:
        filename = contentBaseName  + ('_Scaled_%s_%dx%d.y4m' % (algo, outw, outh))
        upscaledout = os.path.join(path, filename)
    return upscaledout

def GetDownScaledMD5File(clip, dnw, dnh, path, algo):
    contentBaseName = GetShortContentName(clip.file_name, False)
    filename = contentBaseName + ".md5"
    if clip.width != dnw or clip.height != dnh:
        filename = contentBaseName + ('_Scaled_%s_%dx%d.md5' % (algo, dnw, dnh))
    dnscaledmd5 = os.path.join(path, filename)
    return dnscaledmd5

def CalculateDownScaledMD5(clip, dnw, dnh, path, algo, LogCmdOnly):
    dnScaleMD5 = GetDownScaledMD5File(clip, dnw, dnh, path, algo)
    if LogCmdOnly == 1:
        if Platform == "Linux":
            cmd = "md5sum %s &> %s" % (clip.file_path, dnScaleMD5)
        ExecuteCmd(cmd, 1)
    else:
        f = open(dnScaleMD5, 'wt')
        dnScaledOut = GetDownScaledOutFile(clip, dnw, dnh, path, algo)
        MD5 = md5(dnScaledOut)
        f.write(MD5)
        f.close()

def DownScaling(clip, num, outw, outh, path, cfg_path, algo, LogCmdOnly = False):
    dnScaledOut = GetDownScaledOutFile(clip, outw, outh, path, algo)

    Utils.CmdLogger.write("::Downscaling\n")
    if (clip.width != outw or clip.height != outh):
        # call separate process to do the downscaling
        VideoRescaling(clip, num, outw, outh, dnScaledOut, algo, cfg_path,
                       LogCmdOnly)

    CalculateDownScaledMD5(clip, outw, outh, path, algo, LogCmdOnly)

    return dnScaledOut

def UpScaling(clip, num, outw, outh, path, cfg_path, algo, LogCmdOnly = False):
    upScaleOut = GetUpScaledOutFile(clip, outw, outh, algo, path)
    Utils.CmdLogger.write("::Upscaling\n")
    if (clip.width != outw or clip.height != outh):
        # call separate process to do the upscaling
        VideoRescaling(clip, num, outw, outh, upScaleOut, algo, cfg_path,
                       LogCmdOnly)
    return upScaleOut
