#!/bin/bash

# exit on failure
set -e

# exit on unassigned variable
set -u

COMMIT="$1"
TESTNAME="$2"
CODEC="$3"
BRANCH=t-$(echo "${TESTNAME}" | sed "s/:/_/g")

cd ${CODECS_SRC_DIR}/${CODEC}
git reset --hard

if [[ ${COMMIT} == "HEAD" ]];then
    echo "Fetching latest changes from origin, and checking out to current HEAD"
    git fetch origin
    git checkout origin/HEAD
fi

if git checkout ${COMMIT}; then
    echo "Commit found, skipping fetch."
else
    echo "Checking for commit in remotes..."
    git fetch --all
    git checkout ${COMMIT}
fi

git checkout -b ${BRANCH}
git clean -d -x -f

cd ${APP_DIR}
mkdir -p ${RUNS_DST_DIR}/${TESTNAME}

./build_codec.sh
