#! /usr/bin/env node

var spawn = require("child_process").spawn
  , fs    = require("fs")
  , path  = require("path")

var LIBDIR     = "lib"
  , INDIR      = "src"
  , OUTDIR     = "build"
  , debug      = true
  , prettified = true

function getFilesInDir(p) {
  var r = []
  fs.readdirSync(p).forEach(function (x) {
    if (x[0] !== ".") {
      var full = path.join(p, x)
      if (fs.statSync(full).isDirectory()) {
        r = r.concat(getFilesInDir(full))
      } else if (path.extname(x) === ".js") {
        r.push(full)
      }
    }
  })
  return r
}

var libs = getFilesInDir(LIBDIR)

function getFiles(name) {
  var r = []
  getFilesInDir(path.join(INDIR, name)).concat(libs).map(function (x) {
    r.push("--js")
    r.push(x)
  })
  return r
}

function mkdir(name) {
  try {
    fs.mkdirSync(name)
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e
    }
  }
}

function build() {
  mkdir(path.join(OUTDIR, "gsap"))
  mkdir(path.join(OUTDIR, "js"))
  mkdir(path.join(OUTDIR, "map"))

  var commands = [].map.call(arguments, function (a) {
    var folder = a[0]
      , name   = a[1]
      , file   = a[2]

    var sourcemap = path.join(OUTDIR,  "map", file + ".map")

    var command = ["-jar", path.join("closure-compiler", "compiler.jar")].concat(getFiles(folder))
    //command.push("--process_closure_primitives")
    command.push("--only_closure_dependencies")
    command.push("--closure_entry_point", name)
    command.push("--js_output_file", path.join(OUTDIR, "js", file))
    command.push("--define", "util.log.DEBUG=" + debug)
    command.push("--externs", "extern")
    command.push("--externs", path.join(LIBDIR, "util", "extern"))
    command.push("--use_types_for_optimization")
    command.push("--compilation_level", "ADVANCED_OPTIMIZATIONS")
    command.push("--use_only_custom_externs")
    if (prettified) {
      command.push("--debug")
      command.push("--formatting", "PRETTY_PRINT")
    }
    if (debug) {
      // TODO
      ;[//"reportUnknownTypes",
        "accessControls",
        "ambiguousFunctionDecl",
        "checkEventfulObjectDisposal",
        "checkRegExp",
        "checkStructDictInheritance",
        "checkTypes",
        "checkVars",
        "const",
        "constantProperty",
        "deprecated",
        "duplicateMessage",
        "es3",
        "es5Strict",
        "externsValidation",
        "fileoverviewTags",
        "globalThis",
        "internetExplorerChecks",
        "invalidCasts",
        "misplacedTypeAnnotation",
        "missingProperties",
        "missingProvide",
        "missingRequire",
        "missingReturn",
        "nonStandardJsDocs",
        "suspiciousCode",
        "strictModuleDepCheck",
        "typeInvalidation",
        "undefinedNames",
        "undefinedVars",
        "unknownDefines",
        "uselessCode",
        "visibility"].forEach(function (x) {
          command.push("--jscomp_warning", x)
        })
      command.push("--summary_detail_level", "3")
      command.push("--warning_level", "VERBOSE")
      //command.push("--output_manifest", "manifest.MF")

      command.push("--create_source_map", sourcemap)
      command.push("--source_map_format", "V3")
      command.push("--output_wrapper", "%output%\n//# sourceMappingURL=../map/" + file + ".map")
    }

    return {
      command: command,
      sourcemap: sourcemap
    }
  })

  commands.forEach(function (info) {
    setTimeout(function () {
      var io = spawn("java", info.command, { stdio: "inherit" })

      io.on("exit", function (code) {
        if (code !== 0) {
          console.log("exited with code " + code)
        }

        if (debug) {
          // Add "sourcesContent" to source map
          var y = JSON.parse(fs.readFileSync(info.sourcemap, { encoding: "utf8" }))
          y["sourceRoot"] = "../"
          y["sourcesContent"] = y["sources"].map(function (x) {
            return fs.readFileSync(x, { encoding: "utf8" })
          })
          fs.writeFileSync(info.sourcemap, JSON.stringify(y))
        }
      })
    }, 0)
  })
}


build(["server", "main",    "main.js"],
      ["client", "panel",   "panel.js"],
      ["client", "options", "options.js"])
