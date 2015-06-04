#! /usr/bin/env node

var build = require("./lib/util/node/build")

build(function (o) {
  //o.pull("lib/util")
  o.mkdir("build/js")

  o.config = {
    logging: true,
    debug: true,
    sourcemap: true,
    sourceRoot: "../"
  }

  o.closure = {
    path: "closure-compiler/compiler.jar",
    externs: ["extern", "lib/util/extern"],
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
  }
})
