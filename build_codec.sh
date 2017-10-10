#!/bin/bash

# exit on failure
set -e

# exit on unassigned variable
set -u

echo "Building codec '${CODEC}' (using BUILD_OPTIONS '${BUILD_OPTIONS}')"

case "${CODEC}" in
  daala)
    cd ${CODECS_SRC_DIR}/${CODEC}
    gcc -print-prog-name=cc1
    gcc -print-search-dirs
    ./autogen.sh
    ./configure --enable-static --disable-shared --disable-player --disable-dump-images --enable-logging --enable-dump-recons ${BUILD_OPTIONS}
    make -j$(nproc)
    ;;

  thor | thor-rt)
    cd ${CODECS_SRC_DIR}/${CODEC}
    make
    ;;

  x264)
    cd ${CODECS_SRC_DIR}/x264
    ./configure ${BUILD_OPTIONS} --enable-pic
    make
    ;;

  x265 | x265-rt)
    cd ${CODECS_SRC_DIR}/x265/build/linux
    cmake -D ENABLE_SHARED=no ${BUILD_OPTIONS} ../../source/
    make
    ;;

  xvc)
    mkdir -p xvc/build
    pushd xvc/build
    cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTS=OFF -DENABLE_ASSERTIONS=OFF $BUILD_OPTIONS ..
    make -j4
    popd
    ;;

  xvc)
    mkdir -p xvc/build
    pushd xvc/build
    cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTS=OFF -DENABLE_ASSERTIONS=OFF $BUILD_OPTIONS ..
    make -j4
    popd
    ;;

  vp10 | vp10-rt)
    cd ${CODECS_SRC_DIR}/${CODEC}
    ./configure --enable-vp10 ${BUILD_OPTIONS}
    make
    ;;

  av1 | av1-rt)
    cd ${CODECS_SRC_DIR}/${CODEC}
    echo "-- Starting x86_64 Build --"
    if [[ "${BUILD_OPTIONS}" == *"--enable"* ]]; then
      # legacy configure build
      ./configure --enable-av1 --enable-debug --disable-unit-tests --disable-docs ${BUILD_OPTIONS}
      make -j$(nproc)
      mkdir -p x86_64
      mv aomenc aomdec x86_64/
    else
      rm -rf cmake-build || true
      mkdir cmake-build
      pushd cmake-build
      cmake ../ -DCONFIG_UNIT_TESTS=0 -DENABLE_DOCS=0 -DCMAKE_BUILD_TYPE=Release -DAOM_EXTRA_C_FLAGS=-UNDEBUG -DAOM_EXTRA_CXX_FLAGS=-UNDEBUG ${BUILD_OPTIONS}
      make -j$(nproc)
      popd
      mkdir -p x86_64
      mv cmake-build/aomenc cmake-build/aomdec x86_64/
    fi

    echo "-- Finished x86_64 Build --"
    echo "-- Starting Analyzer Build --"
    ${APP_DIR}/build_av1_analyzer.sh || true
    echo "-- Finished Analyzer Build --"
    echo "Note: Analyzer errors will not prevent the run from completing."
    mv x86_64/* ./
    ;;

  vp8 | vp8-rt)
    cd ${CODECS_SRC_DIR}/vp8
    ./configure --enable-vp8 --disable-vp9 ${BUILD_OPTIONS}
    make
    ;;

  vp9 | vp9-rt)
    cd ${CODECS_SRC_DIR}/vp9
    ./configure --enable-vp9 --disable-vp8 ${BUILD_OPTIONS}
    make
    ;;

  rav1e)
    cd ${CODECS_SRC_DIR}/rav1e
    git submodule sync
    git submodule update --init
    cargo build --release
    ;;

  svt-av1)
    cd ${CODECS_SRC_DIR}/svt-av1
    cd Build/linux
    ./build.sh
    ;;

  vvc-vtm)
    cd ${CODECS_SRC_DIR}/vvc-vtm
    cmake . -DCMAKE_BUILD_TYPE=Release
    make -j
    ;;
  *)
    echo "Unknown codec '${CODEC}'" >&2
    exit 1
esac
