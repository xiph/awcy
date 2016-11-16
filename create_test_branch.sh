#!/bin/bash

set -e

COMMIT="$1"

TESTNAME="$2"

CODEC="$3"

BRANCH=t-$(echo "$TESTNAME" | sed "s/:/_/g")

cd $CODEC
git fetch --all
git reset --hard
git checkout $COMMIT
git checkout -b $BRANCH
git clean -d -x -f

cd ..
mkdir -p runs/$TESTNAME

./build_codec.sh
