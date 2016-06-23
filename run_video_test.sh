#!/bin/bash

set -e

./create_test_branch.sh "$1" "$2" $CODEC

mkdir -p "runs/$2/$3"

#export PATH=/sbin:/bin:/usr/sbin:/usr/bin
echo $PATH
echo $HOME
export DAALA_ROOT=daala/

echo Building...
case $CODEC in
  daala)
    pushd $DAALA_ROOT
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
    ./configure --enable-av1 $BUILD_OPTIONS
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

if [ "$QUALITIES" ]; then
  QUALITY_OPTS="-qualities $QUALITIES"
fi

cd rd_tool
DAALA_ROOT=../daala python3 -u rd_tool.py -machines 14 -awsgroup "AOM" -codec $CODEC $QUALITY_OPTS -prefix "../runs/$2/$3" "$3"
if [ "$AB_COMPARE" ]; then
  DAALA_ROOT=../daala python3 -u rd_tool.py -codec $CODEC -awsgroup "AOM" -mode 'ab' -runid "$RUN_ID" "$3"
fi
