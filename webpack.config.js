var path = require("path");


//# Cleanup old build dir
//rm --recursive --force build/gsap
//rm --recursive --force build/lib/gsap
//rm --recursive --force build/lib


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
          optional: [
            "validation.undeclaredVariableCheck",
            //"minification.deadCodeElimination",
            //"minification.constantFolding",
            "minification.memberExpressionLiterals",
            "minification.propertyLiterals",
            //"runtime"
          ]
        }
      }
    ]
  }
};
