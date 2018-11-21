#!/bin/bash

# exit on failure
set -e

# exit on unassigned variable
set -u
COMMIT="$1"

TESTNAME="$2"

CODEC="$3"
BRANCH=t-$(echo "${TESTNAME}" | sed "s/:/_/g")


cd ${CODEC}
git reset --hard
if git checkout ${COMMIT}; then
    echo "Commit found, skipping fetch."
else
    git fetch --all
    git checkout ${COMMIT}
fi

git checkout -b ${BRANCH}
git clean -d -x -f

cd ..
mkdir -p runs/${TESTNAME}

./build_codec.sh
