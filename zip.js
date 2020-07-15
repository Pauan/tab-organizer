const $fs = require("fs");

// TODO sync version of this
function writeZipFile(info) {
	const output = $fs.createWriteStream(info.output);

	const archive = require("archiver")("zip", {
		zlib: { level: 9 } // Sets the compression level.
	});

	archive.on("warning", (err) => {
		console.error(err);
	});

	archive.on("error", (err) => {
		console.error(err);
	});

	archive.pipe(output);

	archive.directory(info.input, false);

	archive.finalize();
}

writeZipFile({
	input: "static",
	output: "tab-organizer.zip"
});
