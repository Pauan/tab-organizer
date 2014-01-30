#! /usr/bin/env node

var exec = require("child_process").exec
  , fs   = require("fs")
  , path = require("path")

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
  return getFilesInDir(path.join(INDIR, name)).concat(libs).map(function (x) {
    return "--js '" + x + "'"
  })
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

function build(name, file) {
  mkdir(path.join(OUTDIR, "js"))
  mkdir(path.join(OUTDIR, "map"))

  var sourcemap = path.join(OUTDIR,  "map", file + ".map")

  var command = ["java", "-jar", path.join("closure-compiler", "compiler.jar")].concat(getFiles(name))
  command.push("--only_closure_dependencies")
  command.push("--closure_entry_point='" + name + "'")
  command.push("--js_output_file='" + path.join(OUTDIR, "js", file) + "'")
  command.push("--define='util.log.DEBUG=" + debug + "'")
  command.push("--externs='extern.js'")
  command.push("--use_types_for_optimization")
  command.push("--compilation_level=ADVANCED_OPTIMIZATIONS")
  command.push("--use_only_custom_externs")
  //--process_closure_primitives
  /*if (uncompiled) {
    command.push("--compiler_flags=--output_manifest='" + deps + ".deps'")
  }*/
  if (prettified) {
    command.push("--debug")
    command.push("--formatting=PRETTY_PRINT")
  }
  if (debug) {
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
      command.push("--jscomp_warning=" + x)
    })
    command.push("--summary_detail_level=3")
    //command.push("--warning_level=VERBOSE")
    //command.push("--output_manifest manifest.MF")

    command.push("--create_source_map='" + sourcemap + "'")
    command.push("--source_map_format=V3")
    command.push("--output_wrapper='%output%//# sourceMappingURL=../map/" + file + ".map'")
  }

  exec(command.join(" "), function (error, stdout, stderr) {
    if (error) {
      throw error
    }
    if (debug) {
      //console.log(stdout)
      console.log(stderr)
    }

    /*if (uncompiled) {
      // Generate HTML file for non-compiled usage
      var x = fs.readFileSync(deps + ".deps", { encoding: "utf8" })
      x = x.replace(/^src\/(.*)$/gm, "    <script src=\"$1\"></script>")
      x = "<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n  </head>\n  <body>\n" + x + "  </body>\n</html>"
      fs.writeFileSync(deps + ".html", x)
      fs.unlinkSync(deps + ".deps")
    }*/

    if (debug) {
      // Add "sourcesContent" to source map
      var y = JSON.parse(fs.readFileSync(sourcemap, { encoding: "utf8" }))
      y["sourceRoot"] = "../"
      y["sourcesContent"] = y["sources"].map(function (x) {
        return fs.readFileSync(x, { encoding: "utf8" })
      })
      fs.writeFileSync(sourcemap, JSON.stringify(y))
    }
  })
}


build("main",    "main.js")
//build("panel",   "panel.js")
//build("options", "options.js")
