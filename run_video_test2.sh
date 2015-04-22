#!/bin/bash

set -e

./create_test_branch.sh "$1" "$2"

mkdir -p "runs/$2/data"

cd rd_tool
DAALA_ROOT=../daala python -u rd_tool.py -individual -codec $CODEC -prefix "../runs/$2/data" "${@:3}"
