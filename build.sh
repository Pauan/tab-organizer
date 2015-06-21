#! /usr/bin/env sh

mkdir build/js -p

browserify --transform babelify src/server.js --outfile build/js/server.js
