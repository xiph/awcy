#!/usr/bin/env python3

import argparse
import csv
import json
import os
import re
import sys
import shutil
from openpyxl import load_workbook
from numpy import *

# offset by 3
met_index = {
    "PSNR": 0,
    "PSNRHVS": 1,
    "SSIM": 2,
    "FASTSSIM": 3,
    "CIEDE2000": 4,
    "PSNR Cb": 5,
    "PSNR Cr": 6,
    "APSNR": 7,
    "APSNR Cb": 8,
    "APSNR Cr": 9,
    "MSSSIM": 10,
    "Encoding Time": 11,
    "VMAF_old": 12,
    "Decoding Time": 13,
    "PSNR Y (libvmaf)": 14,
    "PSNR Cb (libvmaf)": 15,
    "PSNR Cr (libvmaf)": 16,
    "CIEDE2000 (libvmaf)": 17,
    "SSIM (libvmaf)": 18,
    "MS-SSIM (libvmaf)": 19,
    "PSNR-HVS Y (libvmaf)": 20,
    "PSNR-HVS Cb (libvmaf)": 21,
    "PSNR-HVS Cr (libvmaf)": 22,
    "PSNR-HVS (libvmaf)": 23,
    "VMAF": 24,
    "VMAF-NEG": 25,
    "APSNR Y (libvmaf)": 26,
    "APSNR Cb (libvmaf)": 27,
    "APSNR Cr (libvmaf)": 28,
    "CAMBI (libvmaf)": 29,
}

# row_id for different sets inside template.
start_rows = {
    'A1': 2,
    'A2': 50,
    'A3': 182,
    'A4': 230,
    'A5': 266,
    'B1': 290,
    'B2': 350,
    'G1': 416,
    'G2': 440,
    'E': 482
}

run_cfgs = ['RA', 'LD', 'AI', 'AS']

row_header = [
    "TestCfg",
    "EncodeMethod",
    "CodecName",
    "EncodePreset",
    "Class",
    "Name",
    "OrigRes",
    "FPS",
    "BitDepth",
    "CodedRes",
    "QP",
    "Bitrate(kbps)",
    "PSNR_Y",
    "PSNR_U",
    "PSNR_V",
    "SSIM_Y(dB)",
    "MS-SSIM_Y(dB)",
    "VMAF_Y",
    "VMAF_Y-NEG",
    "PSNR-HVS",
    "CIEDE2000",
    "APSNR_Y",
    "APSNR_U",
    "APSNR_V",
    "CAMBI",
    "EncT[s]",
    "DecT[s]",
    "EncInstr",
    "DecInstr",
    "EncCycles",
    "DecCycles",
    "EncMD5"
]


class Logger(object):
    def __init__(self, run_path, args):
        self.this_args = args
        if not args.ctc_export:
            self.terminal = sys.stdout
        self.log = open(run_path + "/csv_export.csv", "w")

    def write(self, message):
        if not self.this_args.ctc_export:
            self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        if not self.this_args.ctc_export:
            self.terminal.flush()
        self.log.flush()


def save_ctc_export(run_path, cmd_args):
    info_data = json.load(open(run_path + "/info.json"))
    task = info_data["task"]
    sets = json.load(
        open(os.path.join(os.getenv("CONFIG_DIR", "rd_tool"), "sets.json")))
    videos = sets[task]["sources"]
    # sort name ascending, resolution descending
    if task != "av2-a1-4k-as":
        videos.sort(key=lambda s: s.lower())
    else:
        videos.sort(
            key=lambda x: x.split("_")[0]
            + "%08d" % (100000 - int(x.split("_")[1].split("x")[0]))
        )
    videos_dir = os.path.join(
        os.getenv("MEDIAS_SRC_DIR", "/mnt/runs/sets"), task
    )  # for getting framerate

    if not cmd_args.ctc_export:
        sys.stdout = Logger(run_path, cmd_args)
        w = csv.writer(sys.stdout, dialect="excel")
    else:
        csv_writer_obj = open(run_path + "/csv_export.csv", 'w')
        w = csv.writer(csv_writer_obj, dialect="excel")

    w.writerow(row_header)
    for video in videos:
        v = open(os.path.join(videos_dir, video), "rb")
        line = v.readline().decode("utf-8")
        fps_n, fps_d = re.search(r"F([0-9]*)\:([0-9]*)", line).group(1, 2)
        width = re.search(r"W([0-9]*)", line).group(1)
        height = re.search(r"H([0-9]*)", line).group(1)
        current_video_set = info_data["task"]
        if 'aomctc' in current_video_set:
            normalized_set = current_video_set.split('-')[1].upper()
        a = loadtxt(os.path.join(run_path, task, video + "-daala.out"))
        for row in a:
            frames = int(row[1]) / int(width) / int(height)
            if info_data["codec"] == "av2-as":
                w.writerow(
                    [
                        "AS",  # TestCfg
                        "aom",  # EncodeMethod
                        info_data["run_id"],  # CodecName
                        "",  # EncodePreset
                        info_data["task"],  # Class
                        video,  # name
                        "3840x2160",  # OrigRes
                        "",  # FPS
                        10,  # BitDepth
                        str(width) + "x" + str(height),  # CodedRes
                        row[0],  # qp
                        int(row[2])
                        * 8.0
                        * float(fps_n)
                        / float(fps_d)
                        / frames
                        / 1000.0,  # bitrate
                        row[met_index["PSNR Y (libvmaf)"] + 3],
                        row[met_index["PSNR Cb (libvmaf)"] + 3],
                        row[met_index["PSNR Cr (libvmaf)"] + 3],
                        row[met_index["SSIM (libvmaf)"] + 3],
                        row[met_index["MS-SSIM (libvmaf)"] + 3],
                        row[met_index["VMAF"] + 3],
                        row[met_index["VMAF-NEG"] + 3],
                        row[met_index["PSNR-HVS Y (libvmaf)"] + 3],
                        row[met_index["CIEDE2000 (libvmaf)"] + 3],
                        row[met_index["APSNR Y (libvmaf)"] + 3],
                        row[met_index["APSNR Cb (libvmaf)"] + 3],
                        row[met_index["APSNR Cr (libvmaf)"] + 3],
                        row[met_index["Encoding Time"] + 3],
                        row[met_index["Decoding Time"] + 3],
                    ]
                )
            else:
                w.writerow(
                    [
                        "RA",  # TestCfg # TODO: FIXME
                        "aom",  # EncodeMethod
                        info_data["run_id"],  # CodecName
                        "",  # EncodePreset #TODO: FIXME
                        normalized_set,  # Class
                        video,  # name
                        str(width) + "x" + str(height),  # OrigRes
                        str(float(fps_n) / float(fps_d)),  # FPS
                        10,  # BitDepth #TODO: FIXME
                        str(width) + "x" + str(height),  # CodedRes
                        int(row[0]),  # qp
                        int(row[2])
                        * 8.0
                        * float(fps_n)
                        / float(fps_d)
                        / frames
                        / 1000.0,  # bitrate
                        row[met_index["PSNR Y (libvmaf)"] + 3],
                        row[met_index["PSNR Cb (libvmaf)"] + 3],
                        row[met_index["PSNR Cr (libvmaf)"] + 3],
                        row[met_index["SSIM (libvmaf)"] + 3],
                        row[met_index["MS-SSIM (libvmaf)"] + 3],
                        row[met_index["VMAF"] + 3],
                        row[met_index["VMAF-NEG"] + 3],
                        row[met_index["PSNR-HVS Y (libvmaf)"] + 3],
                        row[met_index["CIEDE2000 (libvmaf)"] + 3],
                        row[met_index["APSNR Y (libvmaf)"] + 3],
                        row[met_index["APSNR Cb (libvmaf)"] + 3],
                        row[met_index["APSNR Cr (libvmaf)"] + 3],
                        row[met_index["CAMBI (libvmaf)"] + 3],
                        row[met_index["Encoding Time"] + 3],
                        row[met_index["Decoding Time"] + 3],
                        "",  # ENCInstr
                        "",  # DecInstr
                        "",  # EncCycles
                        "",  # DecCycles
                        "",  # EncMD5
                    ]
                )
    if cmd_args.ctc_export:
        csv_writer_obj.close()


def write_xls_rows(run_path, start_id, this_sheet):
    run_file = open(run_path + '/csv_export.csv', 'r')
    run_reader = csv.reader(run_file)
    next(run_reader)
    this_row = start_id
    for this_line in run_reader:
        this_col = 1
        for this_values in this_line:
            this_cell = this_sheet.cell(row=this_row, column=this_col)
            if this_col >= 12 and this_col <= 30 and this_values != "":
                this_cell.value = float(this_values)
            else:
                this_cell.value = this_values
            this_col += 1
        this_row += 1
    run_file.close()


def write_xls_file(run_a, run_b):
    xls_template = os.path.join(
        os.getenv("CONFIG_DIR", "rd_tool"), 'AOM_CWG_Regular_CTCv3_v7.2.xlsm')
    run_a_info = json.load(open(run_a + "/info.json"))
    run_b_info = json.load(open(run_b + "/info.json"))
    run_id_a = run_a_info["run_id"]
    run_id_b = run_b_info["run_id"]
    xls_file = run_a + '/../ctc_results/' + \
        "CTC_Regular_v0-%s-%s.xlsm" % (run_id_a, run_id_b)
    shutil.copyfile(xls_template, xls_file)
    wb = load_workbook(xls_file, read_only=False, keep_vba=True)
    this_codec = run_a_info['codec']
    if '-' in this_codec:
        if this_codec.split('-')[1].upper() in run_cfgs:
            this_cfg = this_codec.split('-')[1].upper()
    else:
        this_cfg = 'RA'
    anchor_sheet_name = 'Anchor-%s' % this_cfg
    anchor_sheet = wb[anchor_sheet_name]
    test_sheet_name = 'Test-%s' % this_cfg
    test_sheet = wb[test_sheet_name]
    current_video_set = run_a_info["task"]
    if 'aomctc' in current_video_set:
        normalized_set = current_video_set.split('-')[1].upper()
        if normalized_set in start_rows.keys():
            start_id = start_rows[normalized_set]
            write_xls_rows(run_a, start_id, anchor_sheet)
            write_xls_rows(run_b, start_id, test_sheet)
            wb.save(xls_file)
    else:
        print("ERROR: Not AOM-CTC Set")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate CTC CSV version of .out files")
    parser.add_argument("run", nargs=1, help="Run folder (Anchor)")
    parser.add_argument("--ctc_export", action='store_true', help="XLS Export")
    parser.add_argument(
        "--run_b", help="Target Run Dir (Only used in CTC case)")
    args = parser.parse_args()

    if not args.ctc_export:
        save_ctc_export(args.run[0], args)
    else:
        if not args.run_b:
            print("ERROR: Missing Target, aborting")
            sys.exit(1)
        save_ctc_export(args.run[0], args)
        save_ctc_export(args.run_b, args)

        write_xls_file(args.run[0], args.run_b)


if __name__ == "__main__":
    main()
