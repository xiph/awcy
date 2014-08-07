#!/bin/bash

set -e

mkdir "runs/$1/$2"

cd rd_tool
DAALA_ROOT=../daala ./rd_tool.py -prefix "../runs/$1/$2" "$2"
