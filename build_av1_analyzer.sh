#!/bin/bash

set -e

# git remote should be https://github.com/mbebenita/aomanalyzer.git
git fetch analyzer
git merge --no-commit -s recursive -X theirs analyzer/master
make distclean

echo Building Analyzer

echo Configuring Old ABI Analyzer
mkdir -p asm
pushd asm
emconfigure ../configure --disable-multithread --disable-runtime-cpu-detect --target=generic-gnu --enable-accounting $BUILD_OPTIONS
emmake make
cp examples/analyzer_decoder examples/analyzer_decoder.bc
emcc -O3 examples/analyzer_decoder.bc -o examples/decoder.js -s TOTAL_MEMORY=134217728 -s MODULARIZE=1 -s EXPORT_NAME="'DecoderModule'" --post-js "../ins/post.js" --memory-init-file 0
popd
mkdir -p ins/bin
cp asm/examples/decoder.js ins/bin/decoder.js

echo Configuring New ABI Analyzer

make distclean
git reset --hard
git merge --no-commit -s recursive -X theirs analyzer/aom-analyzer

mkdir -p asm
pushd asm
emconfigure ../configure --disable-multithread --disable-runtime-cpu-detect --target=generic-gnu --enable-accounting --enable-analyzer $BUILD_OPTIONS
emmake make -j2
cp aomanalyzer aomanalyzer.bc
emcc -O3 aomanalyzer.bc -o aomanalyzer.js -s TOTAL_MEMORY=134217728 -s MODULARIZE=1 -s EXPORT_NAME="'DecoderModule'" --post-js "../aomanalyzer-post.js" --memory-init-file 0
popd
cp asm/aomanalyzer.js ./aomanalyzer.js
