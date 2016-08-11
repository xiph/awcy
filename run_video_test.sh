#!/bin/bash

set -e

#./create_test_branch.sh "$1" "$2" $CODEC

mkdir -p "runs/$2/$3"

export DAALA_ROOT=daala/

OPTS=""

if [ "$QUALITIES" ]; then
  OPTS="$OPTS -qualities $QUALITIES"
fi

if [ "$SAVE_ENCODE" ]; then
  OPTS="$OPTS -save-encode"
fi

cd rd_tool
DAALA_ROOT=../daala python3 -u rd_tool.py -machines "$NUM_MACHINES" -awsgroup "$SCALING_GROUP" -codec $CODEC $OPTS -prefix "../runs/$2/$3" -runid "$RUN_ID" -bindir "../runs/$2/x86_64" "$3"
#DAALA_ROOT=../daala python3 -u rd_tool.py -machineconf localhost.json -codec $CODEC $QUALITY_OPTS -prefix "../runs/$2/$3" -bindir "../runs/$2/x86_64" "$3"
if [ "$AB_COMPARE" ]; then
  DAALA_ROOT=../daala python3 -u rd_tool.py -machines "$NUM_MACHINES" -codec $CODEC -awsgroup "$SCALING_GROUP" -mode 'ab' -runid "$RUN_ID" -bindir "../runs/$2/x86_64" "$3"
fi
