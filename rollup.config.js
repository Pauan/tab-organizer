import resolve from "rollup-plugin-node-resolve";
import purs from "rollup-plugin-purs";
//import sourcemaps from "rollup-plugin-sourcemaps";

export default {
  entry: "src/Options/Main.purs",
  dest: "build/js/options.js",
  format: "iife",
  sourceMap: true,
  plugins: [
    //sourcemaps(),
    purs(),
    resolve()
  ]
};
