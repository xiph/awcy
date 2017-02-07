#!/bin/bash

set -e

# git remote should be https://github.com/mbebenita/aomanalyzer.git
git fetch analyzer
git merge --no-commit -s recursive -X theirs analyzer/master
make distclean

echo Building Analyzer

mkdir -p asm
pushd asm
emconfigure ../configure --disable-multithread --disable-runtime-cpu-detect --target=generic-gnu --enable-accounting --enable-analyzer --disable-docs --disable-webm-io --extra-cflags="-D_POSIX_SOURCE" $BUILD_OPTIONS
emmake make -j2
cp aomanalyzer aomanalyzer.bc
emcc -O3 aomanalyzer.bc -o aomanalyzer.js -s TOTAL_MEMORY=134217728 -s MODULARIZE=1 -s EXPORT_NAME="'DecoderModule'" --post-js "../aomanalyzer-post.js" --memory-init-file 0
popd
cp asm/aomanalyzer.js ./aomanalyzer.js
