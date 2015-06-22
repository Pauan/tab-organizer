#! /usr/bin/env sh

cp node_modules/gsap/src/minified/TweenLite.min.js build/gsap/TweenLite.min.js
cp node_modules/gsap/src/minified/plugins/CSSPlugin.min.js build/gsap/CSSPlugin.min.js
cp node_modules/gsap/src/minified/plugins/ScrollToPlugin.min.js build/gsap/ScrollToPlugin.min.js

mkdir build/js -p

browserify --transform babelify src/server.js --outfile build/js/server.js
#browserify --transform babelify src/panel.js --outfile build/js/panel.js
browserify --transform babelify src/options.js --outfile build/js/options.js
