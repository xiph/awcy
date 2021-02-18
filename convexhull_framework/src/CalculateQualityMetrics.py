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

import logging
from Config import QualityList, LoggerName
import Utils
from CalcQtyWithVmafTool import VMAF_CalQualityMetrics, VMAF_GatherQualityMetrics,\
     VMAFMetricsFullList

subloggername = "CalcQtyMetrics"
loggername = LoggerName + '.' + '%s' % subloggername
logger = logging.getLogger(loggername)

def CalculateQualityMetric(src_file, framenum, reconYUV, fmt, width, height,
                           bit_depth, logfilePath, LogCmdOnly=False):
    Utils.CmdLogger.write("::Quality Metrics\n")
    VMAF_CalQualityMetrics(src_file, reconYUV, fmt, framenum, width, height,
                           bit_depth, logfilePath, LogCmdOnly)

def GatherQualityMetrics(reconYUV, logfilePath):
    qresult, per_frame_log = VMAF_GatherQualityMetrics(reconYUV, logfilePath)
    results = []
    for metric in QualityList:
        if metric in VMAFMetricsFullList:
            indx = VMAFMetricsFullList.index(metric)
            results.append(qresult[indx])
        else:
            logger.error("invalid quality metrics in QualityList")
            results.append(0.0)

    return results, per_frame_log
