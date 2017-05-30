#!/usr/bin/env python3

import requests
import json

r = requests.get('https://arewecompressedyet.com/run_status.json')

for job in r.json():
    s = requests.get('https://arewecompressedyet.com/runs/'+job['run_id']+'/status.txt')
    if s.text == 'running':
        print(job['run_id'])
