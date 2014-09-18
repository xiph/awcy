#!/bin/bash

set -e

./create_test_branch.sh $1 $2

mkdir -p "runs/$2/$3"

cd rd_tool
DAALA_ROOT=../daala python -u rd_tool.py -prefix "../runs/$2/$3" "$3"
