#!/usr/bin/env python3

import datetime

import dateutil
import matplotlib.pyplot as plt
import requests

list = requests.get("https://arewecompressedyet.com/list.json").json()

histogram = {}

for run in list:
    date = dateutil.parser.parse(run["date"])
    yearmonth = date.strftime("%Y-%m")
    if yearmonth in histogram:
        histogram[yearmonth] += 1
    else:
        histogram[yearmonth] = 1

xpos = []
monthnames = []
counts = []
n = 0

for yearmonth in sorted(histogram.keys()):
    xpos.append(n)
    monthnames.append(yearmonth)
    counts.append(histogram[yearmonth])
    n += 1

plt.bar(xpos, counts, tick_label=monthnames, align="center")
plt.show()
