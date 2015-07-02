#! /usr/bin/env sh

watchify --verbose --transform [ babelify --optional validation.undeclaredVariableCheck ] src/panel.js --outfile build/js/panel.js &

watchify --verbose --transform [ babelify --optional validation.undeclaredVariableCheck ] src/options.js --outfile build/js/options.js &

watchify --verbose --transform [ babelify --optional validation.undeclaredVariableCheck ] src/server.js --outfile build/js/server.js
