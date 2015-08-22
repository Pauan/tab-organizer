import { init as init_chrome } from "../chrome/server";
import { init as init_options } from "./options";
import { async } from "../util/async";
import { always, latest } from "../util/ref";


export const init = async([init_chrome,
                           init_options],
                          ({ manifest, button, popups, tabs },
                           { get: opt }) => {

  button.set_tooltip(always(manifest.get("name")));

  const types = {
    "popup": () => {
      popups.open({
        url: "panel.html",

        left: latest([
          opt("screen.available.left"),
          opt("screen.available.width"),
          opt("size.popup.left"),
          opt("size.popup.width")
        ], (screen_left, screen_width, popup_left, popup_width) =>
          screen_left +
          (screen_width * popup_left) -
          (popup_width * popup_left)),

        top: latest([
          opt("screen.available.top"),
          opt("screen.available.height"),
          opt("size.popup.top"),
          opt("size.popup.height")
        ], (screen_top, screen_height, popup_top, popup_height) =>
          screen_top +
          (screen_height * popup_top) -
          (popup_height * popup_top)),

        width: opt("size.popup.width"),
        height: opt("size.popup.height")
      });
    },


    "panel": () => {
      popups.open({
        type: "panel",
        url: "panel.html",

        width: opt("size.panel.width"),
        height: opt("size.panel.height")
      });
    },


    "sidebar": () => {
      popups.open({
        url: "panel.html",

        left: latest([
          opt("size.sidebar.position"),
          opt("size.sidebar"),
          opt("screen.available.left"),
          opt("screen.available.width")
        ], (position, size, left, width) =>
          (position === "right"
            ? left + width - size
            : left)),

        top: latest([
          opt("size.sidebar.position"),
          opt("size.sidebar"),
          opt("screen.available.top"),
          opt("screen.available.height")
        ], (position, size, top, height) =>
          (position === "bottom"
            ? top + height - size
            : top)),

        width: latest([
          opt("size.sidebar.position"),
          opt("size.sidebar"),
          opt("screen.available.width")
        ], (position, size, width) =>
          (position === "left" || position === "right"
            ? size
            : width)),

        height: latest([
          opt("size.sidebar.position"),
          opt("size.sidebar"),
          opt("screen.available.height")
        ], (position, size, height) =>
          (position === "top" || position === "bottom"
            ? size
            : height))
      });
    },


    "tab": () => {
      tabs.open({
        url: "panel.html"
      });
    }
  };

  button.on_click(() => {
    types[opt("popup.type").get()]();
  });

  button.set_bubble_url(opt("popup.type").map((type) =>
                          (type === "bubble" ? "panel.html" : null)));
});
