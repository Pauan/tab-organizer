(function () {
  "use strict";

  var port = chrome.runtime.connect({ name: "lib/keyboard" })

  addEventListener("keydown", function (e) {
    port.postMessage({ key:   e.which // TODO
                     , shift: e.shiftKey
                     , ctrl:  (e.ctrlKey || e.metaKey)
                     , alt:   e.altKey
                     //, altGraphKey: e.altGraphKey
                     })
  }, true)
})()
