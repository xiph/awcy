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

import Utils
from Config import AOMDEC, EnableTimingInfo, Platform, UsePerfUtil
from Utils import ExecuteCmd

def DecodeWithAOM(test_cfg, infile, outfile, dec_perf, decode_to_yuv, LogCmdOnly=False):
    if decode_to_yuv:
        args = " --codec=av1 --summary --rawvideo -o %s %s" % (outfile, infile)
    else:
        args = " --codec=av1 --summary -o %s %s" % (outfile, infile)
    cmd = AOMDEC + args
    if EnableTimingInfo:
        if Platform == "Windows":
            cmd = "ptime " + cmd + " >%s"%dec_perf
        elif Platform == "Darwin":
            cmd = "gtime --verbose --output=%s "%dec_perf + cmd
        else:
            if UsePerfUtil:
                cmd = "3>%s perf stat --log-fd 3 "%dec_perf +cmd
            else:
                cmd = "/usr/bin/time --verbose --output=%s "%dec_perf + cmd

    ExecuteCmd(cmd, LogCmdOnly)

def VideoDecode(test_cfg, codec, infile, outfile, dec_perf, decode_to_yuv, LogCmdOnly=False):
    Utils.CmdLogger.write("::Decode\n")
    if codec == 'av1':
        DecodeWithAOM(test_cfg, infile, outfile, dec_perf, decode_to_yuv, LogCmdOnly)
    else:
        raise ValueError("invalid parameter for decode.")
