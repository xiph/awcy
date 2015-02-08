#!/usr/bin/env python

from __future__ import print_function

import requests
import argparse
import os
import subprocess
import sys
from datetime import datetime

#our timestamping function, accurate to milliseconds
#(remove [:-3] to display microseconds)
def GetTime():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

if 'DAALA_ROOT' not in os.environ:
    print(GetTime(), "Please specify the DAALA_ROOT environment variable to use this tool.")
    sys.exit(1)

key = None
with open('secret_key','r') as keyfile:
    key = keyfile.read().strip()

if key is None:
    print(GetTime(), "Could not open your secret_key file!")
    sys.exit(1)

daala_root = os.environ['DAALA_ROOT']
os.chdir(daala_root)

branch = subprocess.check_output('git symbolic-ref -q --short HEAD',shell=True).strip()

parser = argparse.ArgumentParser(description='Submit test to arewecompressedyet.com')
parser.add_argument('-prefix',default=branch)
args = parser.parse_args()

commit = subprocess.check_output('git rev-parse HEAD',shell=True).strip()
short = subprocess.check_output('git rev-parse --short HEAD',shell=True).strip()
date = subprocess.check_output(['git','show','-s','--format=%ci',commit]).strip()
date_short = date.split()[0]
user = args.prefix

run_id = user+'-'+date_short+'-'+short

print(GetTime(), 'Creating run '+run_id)
r = requests.post("https://arewecompressedyet.com/submit/job", {'run_id': run_id, 'commit': commit, 'key': key})
print(GetTime(), r)
