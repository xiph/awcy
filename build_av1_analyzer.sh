#!/bin/bash

set -e

echo Building Analyzer

make distclean || true

mkdir -p asm
pushd asm
emconfigure ../configure --disable-multithread --disable-runtime-cpu-detect --target=generic-gnu --enable-accounting --enable-inspection --disable-docs --disable-webm-io --extra-cflags="-D_POSIX_SOURCE" $BUILD_OPTIONS
emmake make -j4
cp examples/inspect inspect.bc
emcc -O3 inspect.bc -o inspect.js -s TOTAL_MEMORY=134217728 -s MODULARIZE=1 -s EXPORT_NAME="'DecoderModule'" --post-js "../tools/inspect-post.js" --memory-init-file 0
popd
cp asm/inspect.js ./aomanalyzer.js
