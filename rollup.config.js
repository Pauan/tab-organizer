import rust from "@wasm-tool/rollup-plugin-rust";
import { terser } from "rollup-plugin-terser";
const copy = require("./rollup-plugin-copy/index.js");
import zip from "rollup-plugin-zip";

export default {
    input: {
        sidebar: "src/sidebar/Cargo.toml",
        background: "src/background/Cargo.toml",
        options: "src/options/Cargo.toml",
    },
    output: {
        dir: "static/js",
        format: "esm",
        sourcemap: true,
        // TODO source map URL is missing the js/
        //entryFileNames: "js/[name].js",
    },
    plugins: [
        rust({
            //outDir: "static/js",
            serverPath: "js/",
            importHook: function (path) {
                return "browser.runtime.getURL(" + JSON.stringify(path) + ")";
            },
        }),
        //terser(),
        /*copy({
            assets: ["static"],
        }),
        zip({
            file: "tab-organizer.zip",
        }),*/
    ],
};
