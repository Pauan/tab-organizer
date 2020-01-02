import rust from "rollup-plugin-rust";
import { terser } from "rollup-plugin-terser";
const copy = require("./rollup-plugin-copy/index.js");
import zip from "rollup-plugin-zip";

export default {
    input: {
        "js/sidebar": "src/sidebar/Cargo.toml",
        "js/background": "src/background/Cargo.toml"
    },
    output: {
        dir: "dist",
        format: "esm",
        sourcemap: false,
    },
    plugins: [
        rust({
            importHook: function (path) {
                return "browser.runtime.getURL(" + JSON.stringify(path) + ")";
            },
        }),
        terser(),
        copy({
            assets: ["static"],
        }),
        zip({
            file: "tab-organizer.zip",
        }),
    ],
};
