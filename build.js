const $fs = require("fs");

const type = process.argv[2];

function mkdir(path) {
    try {
        $fs.mkdirSync(path);
    } catch (e) {
        if (e.code !== "EEXIST") {
            throw e;
        }
    }
}

function mv(from, to) {
    $fs.writeFileSync(to, $fs.readFileSync(from));
}

function mv_map(from, to, f) {
    $fs.writeFileSync(to, f($fs.readFileSync(from, { encoding: "utf8" })));
}

function replace(s) {
    return s.replace(/fetch\( *"([^"]+)" *\)/g, "fetch(chrome.runtime.getURL(\"js/$1\"))");
}


mkdir("build/js");
mv_map("target/wasm32-unknown-unknown/" + type + "/background.js", "build/js/background.js", replace);
mv("target/wasm32-unknown-unknown/" + type + "/background.wasm", "build/js/background.wasm");

