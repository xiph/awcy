#!/bin/bash

set -e

./create_test_branch.sh "$1" "$2"

mkdir -p "runs/$2/data"

export PATH=/sbin:/bin:/usr/sbin:/usr/bin

if [ -z $DAALA_ROOT ]; then
  echo "Please set DAALA_ROOT to the location of your libvpx git clone"
  exit 1
fi

echo Building...
pushd $DAALA_ROOT
gcc -print-prog-name=cc1
gcc -print-search-dirs
./autogen.sh; ./configure --enable-static --disable-shared --disable-player --disable-dump-images --enable-logging --enable-dump-recons ; make -j4
popd

cd rd_tool
DAALA_ROOT=../daala python -u rd_tool.py -individual -codec $CODEC -prefix "../runs/$2/data" "${@:3}"
