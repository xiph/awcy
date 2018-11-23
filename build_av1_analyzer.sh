#!/bin/bash

# exit on failure
set -e

# exit on unassigned variable
set -u

echo "Building Analyzer"

# add emscripten tools to PATH
export PATH=${PATH}:$(em-config EMSCRIPTEN_ROOT):$(em-config LLVM_ROOT)

cd ${CODECS_SRC_DIR}/${CODEC}

rm -rf asm/
mkdir -p asm
pushd asm

if [[ "${BUILD_OPTIONS}" == *"--enable"* ]]; then
  #legacy configure
  popd
  make distclean || true
  pushd asm
  emconfigure ../configure --disable-multithread --disable-runtime-cpu-detect --target=generic-gnu --enable-accounting --enable-inspection --disable-docs --disable-webm-io --extra-cflags="-D_POSIX_SOURCE" ${BUILD_OPTIONS}
  emmake make -j$(nproc)
  cp examples/inspect inspect.bc
  emcc -O3 inspect.bc -o inspect.js -s TOTAL_MEMORY=402653184 -s MODULARIZE=1 -s EXPORT_NAME="'DecoderModule'" --post-js "../tools/inspect-post.js" --memory-init-file 0
  popd
  cp asm/inspect.js ./aomanalyzer.js
else
  cmake ../ -DAOM_TARGET_CPU=generic -DCONFIG_MULTITHREAD=0 -DCONFIG_RUNTIME_CPU_DETECT=0 -DCONFIG_ACCOUNTING=1 -DCONFIG_INSPECTION=1 -DENABLE_DOCS=0 -DCONFIG_WEBM_IO=0 -DENABLE_TESTS=0 -DCMAKE_TOOLCHAIN_FILE=$(em-config EMSCRIPTEN_ROOT)/cmake/Modules/Platform/Emscripten.cmake ${BUILD_OPTIONS}
  emmake make -j$(nproc)
  popd
  cp asm/examples/inspect.js ./aomanalyzer.js
fi
