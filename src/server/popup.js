import { init as init_chrome } from "../chrome/server";
import { init as init_options } from "./options";
import { async } from "../util/async";
import { always } from "../util/mutable/ref";


export const init = async([init_chrome,
                           init_options],
                          ({ manifest, button, panels },
                           { get: opt }) => {

  button.set_tooltip(always(manifest.get("name")));

  button.on_click(() => {
    panels.open({
      url: "panel.html",
      width: opt("size.popup.width").get(),
      height: opt("size.popup.height").get()
    });
  });

  button.set_bubble_url(opt("popup.type").map((type) =>
                          (type === "bubble" ? "panel.html" : null)));
});
