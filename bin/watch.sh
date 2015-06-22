#! /usr/bin/env sh

#watchify --verbose --transform babelify src/panel.js --outfile build/js/panel.js &
watchify --verbose --transform babelify src/options.js --outfile build/js/options.js &
watchify --verbose --transform babelify src/server.js --outfile build/js/server.js
