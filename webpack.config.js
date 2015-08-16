var path = require("path");
var fs   = require("fs");

function mkdir(path) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
}

function cp(from, to) {
  fs.writeFileSync(to, fs.readFileSync(from));
}


//# Cleanup old build dir
//rm --recursive --force build/gsap
//rm --recursive --force build/lib/gsap
//rm --recursive --force build/lib

mkdir(path.join("build", "lib"));

cp(path.join("node_modules", "babel-core", "external-helpers.min.js"),
   path.join("build", "lib", "external-helpers.min.js"));


module.exports = {
  "devtool": "source-map",
  // TODO use this, and maybe `source-map-loader` plugin as well
  //devtool: "cheap-module-source-map",

  entry: {
    "server": path.join(__dirname, "src", "server.js"),
    "panel": path.join(__dirname, "src", "panel.js"),
    "options": path.join(__dirname, "src", "options.js")
  },

  output: {
    path: path.join(__dirname, "build", "js"),
    filename: "[name].js",
    sourceMapFilename: path.join("..", "map", "[file].map")
  },

  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        include: path.join(__dirname, "src"),
        loader: "babel-loader",
        query: {
          //cacheDirectory: true,
          externalHelpers: true,
          optional: [
            "validation.undeclaredVariableCheck",
            //"runtime",
            //"minification.deadCodeElimination",
            //"minification.constantFolding",
            "minification.memberExpressionLiterals",
            "minification.propertyLiterals",
          ]
        }
      }
    ]
  }
};
