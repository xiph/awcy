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
from Config import AOMENC, SVTAV1, EnableTimingInfo, Platform
from Utils import ExecuteCmd

def get_qindex_from_QP(QP):
    quantizer_to_qindex = [
    0,   4,   8,   12,  16,  20,  24,  28,  32,  36,  40,  44,  48,
    52,  56,  60,  64,  68,  72,  76,  80,  84,  88,  92,  96,  100,
    104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 148, 152,
    156, 160, 164, 168, 172, 176, 180, 184, 188, 192, 196, 200, 204,
    208, 212, 216, 220, 224, 228, 232, 236, 240, 244, 249, 255]
    if (QP > 63):
        print(" QP %d is out of range (0 to 63), clamp to 63", QP)
        return quantizer_to_qindex[63]
    return quantizer_to_qindex[QP]

def EncodeWithAOM_AV1(clip, test_cfg, QP, framenum, outfile, preset, enc_perf,
                      enc_log, LogCmdOnly=False):
    args = " --verbose --codec=av1 -v --psnr --obu --frame-parallel=0" \
           " --cpu-used=%s --limit=%d --passes=1 --end-usage=q --i%s " \
           " --use-fixed-qp-offsets=1 --deltaq-mode=0 " \
           " --enable-tpl-model=0 --enable-keyframe-filtering=0 --fps=%d/%d " \
           " --input-bit-depth=%d --bit-depth=%d --cq-level=%d -w %d -h %d" \
           % (preset, framenum, clip.fmt, clip.fps_num, clip.fps_denom,
              clip.bit_depth, clip.bit_depth, QP, clip.width, clip.height)

    # For 4K clip, encode with 2 tile columns using two threads.
    # --tile-columns value is in log2.
    if (clip.width >= 3840 and clip.height >= 2160):
        args += " --tile-columns=1 --threads=2 --row-mt=0 "
    else:
        args += " --tile-columns=0 --threads=1 "

    if test_cfg == "AI" or test_cfg == "STILL":
        args += " --kf-min-dist=0 --kf-max-dist=0 "
    elif test_cfg == "RA" or test_cfg == "AS":
        args += " --min-gf-interval=16 --max-gf-interval=16 --gf-min-pyr-height=4" \
                " --gf-max-pyr-height=4 --kf-min-dist=65 --kf-max-dist=65" \
                " --lag-in-frames=19 --auto-alt-ref=1 "
    elif test_cfg == "LD":
        args += " --kf-min-dist=9999 --kf-max-dist=9999 --lag-in-frames=0" \
                " --min-gf-interval=16 --max-gf-interval=16 --gf-min-pyr-height=4 " \
                " --gf-max-pyr-height=4 --subgop-config-str=ld "
    else:
        print("Unsupported Test Configuration %s" % test_cfg)
    args += " -o %s %s" % (outfile, clip.file_path)
    cmd = AOMENC + args + "> %s 2>&1"%enc_log
    if (EnableTimingInfo):
        if Platform == "Windows":
            cmd = "ptime " + cmd + " >%s"%enc_perf
        elif Platform == "Darwin":
            cmd = "gtime --verbose --output=%s "%enc_perf + cmd
        else:
            cmd = "/usr/bin/time --verbose --output=%s "%enc_perf + cmd
    ExecuteCmd(cmd, LogCmdOnly)

def EncodeWithSVT_AV1(clip, test_cfg, QP, framenum, outfile, preset, enc_perf,
                      enc_log, LogCmdOnly=False):
    #TODO: update svt parameters
    args = " --preset %s --scm 2 --lookahead 0 --hierarchical-levels 3 -n %d" \
           " --keyint 255 -rc 0 -q %d -w %d -h %d -b %s -i %s"\
           % (str(preset), framenum, QP, clip.width, clip.height, outfile,
              clip.file_path)
    cmd = SVTAV1 + args + "> %s 2>&1"%enc_log
    if EnableTimingInfo:
        if Platform == "Windows":
            cmd = "ptime " + cmd + " >%s"%enc_perf
        elif Platform == "Darwin":
            cmd = "gtime --verbose --output=%s "%enc_perf + cmd
        else:
            cmd = "/usr/bin/time --verbose --output=%s "%enc_perf + cmd
    ExecuteCmd(cmd, LogCmdOnly)

def VideoEncode(EncodeMethod, CodecName, clip, test_cfg, QP, framenum, outfile,
                preset, enc_perf, enc_log, LogCmdOnly=False):
    Utils.CmdLogger.write("::Encode\n")
    if CodecName == 'av1':
        if EncodeMethod == "aom":
            EncodeWithAOM_AV1(clip, test_cfg, QP, framenum, outfile, preset,
                              enc_perf, enc_log, LogCmdOnly)
        elif EncodeMethod == "svt":
            EncodeWithSVT_AV1(clip, test_cfg, QP, framenum, outfile, preset,
                              enc_perf, enc_log, LogCmdOnly)
        else:
            raise ValueError("invalid parameter for encode.")
    else:
        raise ValueError("invalid parameter for encode.")
