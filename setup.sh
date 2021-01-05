#!/bin/bash

git clone https://aomedia.googlesource.com/aom av1
ln -s av1 av1-rt

git clone https://aomedia.googlesource.com/aom av2

mkdir runs
touch list.json
