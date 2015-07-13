#! /usr/bin/env sh

# Cleanup old build dir
rm --recursive --force build/gsap
rm --recursive --force build/lib/gsap

cp node_modules/babel-core/browser-polyfill.min.js build/lib/browser-polyfill.min.js

mkdir build/js --parents

browserify --transform [ babelify --optional validation.undeclaredVariableCheck ] src/server.js --outfile build/js/server.js

browserify --transform [ babelify --optional validation.undeclaredVariableCheck ] src/panel.js --outfile build/js/panel.js

browserify --transform [ babelify --optional validation.undeclaredVariableCheck ] src/options.js --outfile build/js/options.js
