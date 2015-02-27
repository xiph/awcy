#!/bin/bash

TESTNAME=$1

if [ -n "$TESTNAME" ] ; then
  rm -rf runs/$TESTNAME

  cd daala
  git branch -D t-$TESTNAME
fi

node generate_list.js
