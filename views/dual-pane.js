/*global action, state, UI, Window */

(function () {
    "use strict";

    document.body.appendChild(UI.create("div", function (element) {
        element.className = "window-list";

        UI.scrollBar(element, { side: "left" });

        state.createView = function (windows) {
            var fragment = document.createDocumentFragment();

            windows.forEach(function (win) {
                if (win.type === "normal") {
                    fragment.appendChild(Window.proxy(win));
                    element.appendChild(Window.proxy(win));
                }
            });

            state.windowList.appendChild(fragment);
        };
    }));

    document.body.appendChild(UI.create("div", function (element) {
        element.className = "window-list";

        UI.scrollBar(element, { side: "right" });

        state.windowList = element;

        action.attachEvents(element);
    }));
}());
