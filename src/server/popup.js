import { init as init_chrome } from "../chrome/server";
import { init as init_options } from "./options";
import { async } from "../util/async";
import { always, latest } from "../util/ref";


export const init = async([init_chrome,
                           init_options],
                          ({ manifest, button, panels },
                           { get: opt }) => {

  button.set_tooltip(always(manifest.get("name")));

  button.on_click(() => {
    panels.open({
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
  });

  button.set_bubble_url(opt("popup.type").map((type) =>
                          (type === "bubble" ? "panel.html" : null)));
});
