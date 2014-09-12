#! /usr/bin/env conductance

@ = require([
  { id: "sjs:bundle" },
  { id: "sjs:sys" },
  // TODO
  // { id: "sjs:nodejs/mkdirp" },
  { id: "sjs:nodejs/fs", name: "fs" },
  { id: "sjs:logging", name: "logging" },
  { id: "sjs:function" },
  { id: "sjs:sequence" },
  { id: "sjs:object" },
  { id: "sjs:dashdash", name: "dashdash" },
  { id: "nodejs:fs", name: "nodefs" },
  { id: "nodejs:path", name: "path" },
  { id: "nodejs:uglify-js", name: "uglify" }
])

// TODO this should probably use streams or something
// TODO standard library function for this
function cp(from, to) {
  var file = @fs.readFile(from)
  @fs.writeFile(to, file)
}

// TODO mkdirp
// TODO standard library function for this
function mkdir(path) {
  try {
    @fs.mkdir(path)
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e
    }
  }
}

// TODO standard library function for this
function getAllFiles(path) {
  var result = []
  ;(function loop(path) {
    @fs.readdir(path) ..@each(function (x) {
      // TODO is it safe to use / here rather than path.join ?
      var file = path + "/" + x
      if (@fs.isDirectory(file)) {
        loop(file)
      } else {
        result.push(file)
      }
    })
  })(path)
  return result
}

// TODO assert that path is a directory
function getAllDirs(path) {
  var result = []
  ;(function loop(path) {
    result.push(path)
    @fs.readdir(path) ..@each(function (x) {
      // TODO is it safe to use / here rather than path.join ?
      var file = path + "/" + x
      if (@fs.isDirectory(file)) {
        loop(file)
      }
    })
  })(path)
  return result
}

function linebreak() {
  // TODO standard library function for this
  console.log(new Array(80 + 1).join("-"))
}

// TODO standard library function for this
function minify(str) {
  var mini = @uglify.minify(str, {
    fromString: true,
    /*mangle: {
      sort: true,
    },
    output: null,
    compress: {
      properties: true,
      dead_code: true,
      unsafe: true, // TODO is this okay?
      conditionals: true,
      comparisons: true,
      evaluate: true,
      booleans: true,
      loops: true,
      unused: true,
      hoist_funs: true,
      if_return: true,
      join_vars: true,
      cascade: true,
      negate_iife: true,
      pure_getters: true, // TODO is this okay?
    }*/
  })
  return mini.code
}


// TODO function/exclusive makes sure that if compile is called multiple times, it'll only call it once... but is exclusive the best way to do that?
var compile = @exclusive(function (files, opts) {
  try {
    // TODO is this the correct logging level ?
    // TODO this should be an option for the bundle/create function
    using (@logging.logContext({ level: @logging.WARN })) {
      files ..@ownPropertyPairs ..@each(function ([from, to]) {
        // TODO should use streams so it works on huge files
        var output = @create({
          resources: {
            ".": ""
          },
          hubs: {
            "lib:": "lib/"
          },
          compile: true,
          sources: [ from, "sjs:xbrowser/dom" ] // TODO get rid of this dependency
        })

        output = output ..@join("\n")
        //output = "\"use strict\";var __oni_rt_bundle;" + output

        if (opts.minify) {
          console.log("#{Date.now()} Minifying \"#{to}\"")
          @fs.writeFile(to, minify(output), "utf8")
        } else {
          @fs.writeFile(to, output, "utf8")
        }
      })
    }
    console.log("#{Date.now()} Compiled successfully")
  } catch (e) {
    linebreak()
    console.error(e.message)
    linebreak()
  }
})

function watch(dir, files, opts) {
  // TODO standard library function for this
  getAllDirs(dir) ..@each(function (path) {
    console.log("#{Date.now()} Watching folder #{path}")
    // TODO use function/exclusive here, rather than in compile?
    @nodefs.watch(path, function (event, filename) {
      compile(files, opts)
    })
  })
}


// TODO help messages and stuff
var opts = @dashdash.parse({
  options: [
    {
      names: ["watch"],
      type: "bool"
    }
  ]
})

// TODO can I rely on sys/executable ?
var sjsPath = @path.relative(".", @path.join(@path.dirname(@executable), "stratified-aot.js"))

var files = {
  "./src/server/main.sjs":         "./build/js/main.js",
  "./src/client/options/main.sjs": "./build/js/options.js"
}

mkdir("./build/js")
mkdir("./build/lib")

@fs.writeFile("./build/lib/stratified.js", minify(@fs.readFile(sjsPath, "utf8")))
console.log("#{Date.now()} Copied \"#{sjsPath}\"")

if (opts.watch) {
  watch("./lib", files, { minify: false })
  watch("./src", files, { minify: false })
  compile(files, { minify: false })
} else {
  compile(files, { minify: true })
}
