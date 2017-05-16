#!/bin/bash
cd ../aomanalyzer
git pull
npm install
npm run build-release
echo Building downloadable analyzers
npm run package-linux
npm run package-darwin
npm run package-win32
cd release_builds
tar -czf AOMAnalyzer-linux-x64.tar.gz AOMAnalyzer-linux-x64/
tar -czf AOMAnalyzer-darwin-x64.tar.gz AOMAnalyzer-darwin-x64/
zip -r AOMAnalyzer-win32-x64.zip AOMAnalyzer-win32-x64/
