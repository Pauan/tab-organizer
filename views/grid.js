/*global action, state, UI, Window */

(function () {
    "use strict";

    document.body.appendChild(UI.create("div", function (element) {
        element.className = "window-list";

        state.windowList = element;

        action.attachEvents(element);
    }));
}());
