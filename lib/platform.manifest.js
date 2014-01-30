goog.provide("platform.manifest")

goog.scope(function () {
  var manifest = chrome["runtime"]["getManifest"]()

  platform.manifest.get = function (s) {
    return manifest[s]
  }
})