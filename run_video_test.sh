#!/bin/bash

set -e

#./create_test_branch.sh "$1" "$2" $CODEC

mkdir -p "runs/$2/$3"

export DAALA_ROOT=daala/

if [ "$QUALITIES" ]; then
  QUALITY_OPTS="-qualities $QUALITIES"
fi

cd rd_tool
DAALA_ROOT=../daala python3 -u rd_tool.py -machines 13 -awsgroup "AOM" -codec $CODEC $QUALITY_OPTS -prefix "../runs/$2/$3" "$3"
#DAALA_ROOT=../daala python3 -u rd_tool.py -machineconf localhost.json -codec $CODEC $QUALITY_OPTS -prefix "../runs/$2/$3" -bindir "../runs/$2/x86_64" "$3"
if [ "$AB_COMPARE" ]; then
  DAALA_ROOT=../daala python3 -u rd_tool.py -machines 13 -codec $CODEC -awsgroup "AOM" -mode 'ab' -runid "$RUN_ID" "$3"
fi
