#!/bin/bash
set -e

echo Building...
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
  x265)
    pushd x265/build/linux
    cmake -D ENABLE_SHARED=no $BUILD_OPTIONS ../../source/
    make
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
    ./configure --enable-av1 --disable-unit-tests --disable-docs $BUILD_OPTIONS
    make
    popd
    ;;
  vp9)
    pushd vp9
    ./configure --enable-vp9 $BUILD_OPTIONS
    make
    popd
    ;;
esac
