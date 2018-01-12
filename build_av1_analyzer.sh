#!/bin/bash

set -e

echo Building Analyzer

rm -rf asm/
mkdir -p asm
pushd asm
if [[ $BUILD_OPTIONS == *"--enable"* ]]; then
  #legacy configure
  popd
  make distclean || true
  pushd asm
  emconfigure ../configure --disable-multithread --disable-runtime-cpu-detect --target=generic-gnu --enable-accounting --enable-inspection --disable-docs --disable-webm-io --extra-cflags="-D_POSIX_SOURCE" $BUILD_OPTIONS
  emmake make -j4
  cp examples/inspect inspect.bc
  emcc -O3 inspect.bc -o inspect.js -s TOTAL_MEMORY=402653184 -s MODULARIZE=1 -s EXPORT_NAME="'DecoderModule'" --post-js "../tools/inspect-post.js" --memory-init-file 0
  popd
  cp asm/inspect.js ./aomanalyzer.js
else
  cmake ../ -DAOM_TARGET_CPU=generic -DCONFIG_MULTITHREAD=0 -DCONFIG_RUNTIME_CPU_DETECT=0 -DCONFIG_ACCOUNTING=1 -DCONFIG_INSPECTION=1 -DENABLE_DOCS=0 -DCONFIG_WEBM_IO=0 -DCMAKE_TOOLCHAIN_FILE=$(em-config EMSCRIPTEN_ROOT)/cmake/Modules/Platform/Emscripten.cmake $BUILD_OPTIONS
  emmake make -j4
  popd
  cp asm/examples/inspect.js ./aomanalyzer.js
fi
