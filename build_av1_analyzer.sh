#!/bin/bash

set -e

# git remote should be https://github.com/mbebenita/aomanalyzer.git
git fetch analyzer
git merge --no-commit -s recursive -X theirs analyzer/accounting-analyzer
make distclean
./build_analyzer.sh
