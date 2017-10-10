#!/bin/bash
set -e

echo Building...
echo $BUILD_OPTIONS
case $CODEC in
  daala)
    pushd $CODEC
    gcc -print-prog-name=cc1
    gcc -print-search-dirs
    ./autogen.sh; ./configure --enable-static --disable-shared --disable-player --disable-dump-images --enable-logging --enable-dump-recons $BUILD_OPTIONS; make -j4
    popd
    ;;
  thor | thor-rt)
    pushd $CODEC
    make
    popd
    ;;
  x264)
    pushd x264/
    ./configure $BUILD_OPTIONS
    make
    popd
    ;;
  x265 | x265-rt)
    pushd x265/build/linux
    cmake -D ENABLE_SHARED=no $BUILD_OPTIONS ../../source/
    make
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
    pushd $CODEC
    ./configure --enable-vp10 $BUILD_OPTIONS
    make
    popd
    ;;
  av1 | av1-rt)
    pushd $CODEC
    echo -- Starting x86_64 Build --
    if [[ $BUILD_OPTIONS == *"--enable"* ]]; then
      # legacy configure build
      ./configure --enable-av1 --enable-debug --disable-unit-tests --disable-docs $BUILD_OPTIONS
      make -j4
      mkdir -p x86_64
      mv aomenc aomdec x86_64/
    else
      rm -rf cmake-build || true
      mkdir cmake-build
      pushd cmake-build
      cmake ../ -DCONFIG_UNIT_TESTS=0 -DENABLE_DOCS=0 -DCMAKE_BUILD_TYPE=Release -DAOM_EXTRA_C_FLAGS=-UNDEBUG -DAOM_EXTRA_CXX_FLAGS=-UNDEBUG $BUILD_OPTIONS
      make -j4
      popd
      mkdir -p x86_64
      mv cmake-build/aomenc cmake-build/aomdec x86_64/
    fi
    echo -- Finished x86_64 Build --
    echo -- Starting Analyzer Build --
    ../build_av1_analyzer.sh || true
    echo -- Finished Analyzer Build --
    echo Note: Analyzer errors will not prevent the run from completing.
    mv x86_64/* ./
    popd
    ;;
  vp9 | vp9-rt)
    pushd vp9
    ./configure --enable-vp9 $BUILD_OPTIONS
    make
    popd
    ;;
  rav1e)
    pushd rav1e
    git submodule update --init
    cargo build --release
    popd
    ;;
esac
