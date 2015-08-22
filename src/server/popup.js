import { init as init_chrome } from "../chrome/server";
import { init as init_options } from "./options";
import { async } from "../util/async";
import { always, latest } from "../util/ref";


export const init = async([init_chrome,
                           init_options],
                          ({ manifest, button, popups },
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
    }
  };

  button.on_click(() => {
    types[opt("popup.type").get()]();
  });

  button.set_bubble_url(opt("popup.type").map((type) =>
                          (type === "bubble" ? "panel.html" : null)));
});
