#! /usr/bin/env node

var build = require("./lib/util/build")

build.mkdir("build/js")

build.compile({
  logging: true,
  debug: true,
  sourcemap: true,
  closure: "closure-compiler/compiler.jar",
  externs: ["extern", "lib/util/extern"],
  sourceRoot: "../",
  modules: {
    "main": {
      dirs: ["lib", "src/server"],
      outfile: "build/js/main.js"
    },
    "panel": {
      dirs: ["lib", "src/client"],
      outfile: "build/js/panel.js"
    },
    "options": {
      dirs: ["lib", "src/client"],
      outfile: "build/js/options.js"
    }
  }
})
