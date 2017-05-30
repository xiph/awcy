#!/usr/bin/env python3

import requests
import sys

f = open(sys.argv[1],'r')
for line in f.readlines():
    url = 'http://localhost:4000/submit?run_id='+line.strip()
    print(url)
    r = requests.get(url)
    print(r.text)
