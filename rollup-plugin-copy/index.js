const $fs = require("fs");
const $path = require("path");

function readfile(path) {
    return new Promise(function (resolve, reject) {
        $fs.readFile(path, function (err, file) {
            if (err) {
                reject(err);

            } else {
                resolve(file);
            }
        });
    });
}

function readdir(path) {
    return new Promise(function (resolve, reject) {
        $fs.readdir(path, function (err, files) {
            if (err) {
                if (err.code === "ENOTDIR") {
                    resolve(null);

                } else {
                    reject(err);
                }

            } else {
                resolve(files);
            }
        });
    });
}

async function generateBundle(_, bundle, assets) {
    await Promise.all(assets.map(function (asset) {
        return recurse(bundle, asset, "");
    }));
}

async function recurse(bundle, path, dir) {
    const files = await readdir(path);

    if (files === null) {
        const file = await readfile(path);

        bundle[dir] = {
            fileName: dir,
            isAsset: true,
            source: file,
        };

    } else {
        await Promise.all(files.map(function (file) {
            return recurse(bundle, $path.join(path, file), $path.join(dir, file));
        }));
    }
}

// TODO error checking for options
// TODO support glob
module.exports = function (options = {}) {
    return {
        name: "copy",

        generateBundle(x, bundle) {
            return generateBundle(x, bundle, options.assets);
        },
    };
};
