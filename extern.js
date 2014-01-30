/** @const @dict */
var chrome = {}

/** @const @dict */
var localStorage = {}

/** @const @dict */
var performance = {}

/** @const @dict */
var screen = {}

/** @const @dict */
var console = {}

/** @const @dict */
var Math = {}

/** @const @dict */
var document = {}

/** @const @dict */
var Object = {}


/** @const @dict @type {function (new:Error, *=, *=, *=): Error} */
function Error() {}
Error.prototype = {}

/** @const @dict @type {function (new:Date, ?=, ?=, ?=, ?=, ?=, ?=, ?=): string}*/
function Date() {}

/** @const @dict @constructor */
function Arguments() {}

/** @const @dict @constructor */
function MutationObserver(x) {}

/** @const @dict @constructor */
function FileReader() {}


/** @const @type {undefined} */
var undefined

/** @const @type {!Arguments} */
var arguments

/** @const */
function alert(x) {}

/** @const */
function setTimeout(f, i) {}

/** @const */
function clearTimeout(i) {}

/** @const */
function addEventListener(s, f, b) {}

/** @const */
function removeEventListener(s, f, b) {}
