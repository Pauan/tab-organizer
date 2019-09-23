const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

const dist = path.resolve(__dirname, "dist");

module.exports = {
  mode: "production",
  stats: "errors-warnings",
  entry: {
    "js/sidebar": "./js/sidebar.js"
  },
  output: {
    path: dist,
    filename: "[name].js"
  },
  devServer: {
    liveReload: true,
    open: true,
    noInfo: true,
    overlay: true
  },
  plugins: [
    new CopyPlugin([
      path.resolve(__dirname, "static")
    ]),

    new WasmPackPlugin({
      crateDirectory: path.join(__dirname, "src", "sidebar"),
      extraArgs: "--out-name sidebar"
    }),
  ]
};
