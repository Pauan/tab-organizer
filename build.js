#! /usr/bin/env node

var build = require("./lib/util/build")
  , path  = require("path")

build.mkdir(path.join("build", "js"))

build.compile({
  debug: true,
  closure: path.join("closure-compiler", "compiler.jar"),
  externs: ["extern", path.join("lib", "util", "extern")],
  sourceRoot: "../",
  modules: {
    "main": {
      dirs: ["lib", path.join("src", "server")],
      outfile: path.join("build", "js", "main.js")
    },
    "panel": {
      dirs: ["lib", path.join("src", "client")],
      outfile: path.join("build", "js", "panel.js")
    },
    "options": {
      dirs: ["lib", path.join("src", "client")],
      outfile: path.join("build", "js", "options.js")
    }
  }
})
