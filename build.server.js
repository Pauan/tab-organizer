import purs from "rollup-plugin-purs";
import sourcemaps from "rollup-plugin-sourcemaps";

export default {
  entry: "src/Server/Main.purs",
  dest: "build/js/server.js",
  format: "iife",
  sourceMap: true,
  plugins: [
    purs(),
    //sourcemaps()
  ]
};
