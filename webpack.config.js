var webpack = require("webpack");
var path    = require("path");
var fs      = require("fs");

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


module.exports = {
  //"devtool": "source-map",
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

  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "common-client",
      chunks: ["panel", "options"]
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: "common",
      chunks: ["server", "panel", "options", "common-client"],
      minChunks: 2
    })
  ],

  module: {
    loaders: [
      {
        test: /\.js$/,
        include: path.join(__dirname, "src"),
        loader: "babel",
        query: {
          cacheDirectory: true,
          presets: ["es2015"],
          plugins: [
            "transform-runtime",
            //"undeclared-variables-check",
            "transform-member-expression-literals",
            "transform-property-literals",
            "transform-strict-mode",
            require("babel-plugin-transform-flow-comments")
          ]
        }
      }
    ]
  }
};
