#! /usr/bin/env sh

# Cleanup old build dir
rm --recursive --force build/gsap

cp node_modules/gsap/src/minified/TweenLite.min.js build/lib/gsap/TweenLite.min.js
cp node_modules/gsap/src/minified/plugins/CSSPlugin.min.js build/lib/gsap/CSSPlugin.min.js
cp node_modules/gsap/src/minified/plugins/ScrollToPlugin.min.js build/lib/gsap/ScrollToPlugin.min.js

cp node_modules/babel-core/browser-polyfill.min.js build/lib/browser-polyfill.min.js

mkdir build/js --parents

browserify --transform babelify src/server.js --outfile build/js/server.js
#browserify --transform babelify src/panel.js --outfile build/js/panel.js
browserify --transform babelify src/options.js --outfile build/js/options.js
