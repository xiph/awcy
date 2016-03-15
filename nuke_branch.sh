#!/bin/bash

TESTNAME=$1

if [ -n "$TESTNAME" ] ; then
  rm -rf runs/$TESTNAME

  pushd daala
  git branch -D t-$TESTNAME
  popd
fi

node generate_list.js
