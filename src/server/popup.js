import { init as init_chrome } from "../chrome/server";
import { init as init_options } from "./options";
import { async } from "../util/async";
import { always } from "../util/ref";
import { fail } from "../util/assert";


export const init = async([init_chrome,
                           init_options],
                          ({ manifest, button, popups, tabs },
                           { get: opt }) => {

  button.set_tooltip(always(manifest.get("name")));

  const panel_url = "panel.html";

  let popup       = null;
  let panel       = null;
  let tab         = null;
  let window_size = null;


  const cleanup_popup = () => {
    popup = null;
    window_size = null;
  };

  const cleanup_panel = () => {
    panel = null;
  };

  const cleanup_tab = () => {
    tab = null;
  };


  const close_popup = () => {
    if (popup !== null) {
      popup.close();
      cleanup_popup();
    }
  };

  const close_panel = () => {
    if (panel !== null) {
      panel.close();
      cleanup_panel();
    }
  };

  const close_tab = () => {
    if (tab !== null) {
      tab.close();
      cleanup_tab();
    }
  };


  const get_screen_size = (f) => {
    f({
      left:   opt("screen.available.left").get(),
      top:    opt("screen.available.top").get(),
      width:  opt("screen.available.width").get(),
      height: opt("screen.available.height").get()
    });
  };

  const get_popup_dimensions = (type, screen) => {
    switch (type) {
    case "popup":
      const popup_left   = opt("size.popup.left").get();
      const popup_top    = opt("size.popup.top").get();
      const popup_width  = opt("size.popup.width").get();
      const popup_height = opt("size.popup.height").get();

      return {
        left: screen.left +
              (screen.width * popup_left) -
              (popup_width * popup_left),

        top: screen.top +
             (screen.height * popup_top) -
             (popup_height * popup_top),

        width: popup_width,

        height: popup_height
      };


    case "sidebar":
      const sidebar_position = opt("size.sidebar.position").get();
      const sidebar_size     = opt("size.sidebar").get();

      return {
        left: (sidebar_position === "right"
                ? screen.left + screen.width - sidebar_size
                : screen.left),

        top: (sidebar_position === "bottom"
               ? screen.top + screen.height - sidebar_size
               : screen.top),

        width: (sidebar_position === "left" ||
                sidebar_position === "right"
                 ? sidebar_size
                 : screen.width),

        height: (sidebar_position === "top" ||
                 sidebar_position === "bottom"
                  ? sidebar_size
                  : screen.height)
      };


    default:
      fail();
    }
  };

  const get_window_size = (screen) => {
    const sidebar_position = opt("size.sidebar.position").get();
    const sidebar_size     = opt("size.sidebar").get();

    return {
      left:   (sidebar_position === "left"
                ? screen.left + sidebar_size
                : screen.left),

      top:    (sidebar_position === "top"
                ? screen.top + sidebar_size
                : screen.top),

      width:  (sidebar_position === "left" ||
               sidebar_position === "right"
                ? screen.width - sidebar_size
                : screen.width),

      height: (sidebar_position === "top" ||
               sidebar_position === "bottom"
                ? screen.height - sidebar_size
                : screen.height)
    };
  };

  const open_popup = (type) => {
    close_panel();
    close_tab();

    // TODO what if this is called again before the popup has been opened ?
    get_screen_size((screen) => {
      const dimensions = get_popup_dimensions(type, screen);

      // TODO
      if (type === "sidebar") {
        window_size = get_window_size(screen);
      } else {
        window_size = null;
      }

      if (popup === null) {
        popup = popups.open({
          url: panel_url,
          left: dimensions.left,
          top: dimensions.top,
          width: dimensions.width,
          height: dimensions.height
        });

      } else {
        popup.move(dimensions);
        popup.focus();
      }
    });
  };


  const open_panel = () => {
    close_popup();
    close_tab();

    const dimensions = {
      width:  opt("size.panel.width").get(),
      height: opt("size.panel.height").get()
    };

    if (panel === null) {
      panel = popups.open({
        type: "panel",
        url: panel_url,
        width: dimensions.width,
        height: dimensions.height
      });

    } else {
      panel.move(dimensions);
      panel.focus();
    }
  };


  const open_tab = () => {
    close_popup();
    close_panel();

    if (tab === null) {
      tabs.open({
        url: panel_url
      }, (x) => {
        // TODO what if open_tab is called before the tab has opened ?
        tab = x;
      });

    } else {
      tab.focus();
    }
  };


  const open_bubble = () => {
    close_popup();
    close_panel();
    close_tab();
  };


  const types = {
    "popup": open_popup,
    "panel": open_panel,
    "sidebar": open_popup,
    "tab": open_tab
  };


  popups.on_close((x) => {
    if (panel !== null && panel === x) {
      cleanup_panel();
    }

    if (popup !== null && popup === x) {
      cleanup_popup();
    }
  });


  tabs.on_close((x) => {
    if (tab !== null && tab === x.tab) {
      cleanup_tab();
    }
  });


  button.on_click(() => {
    const type = opt("popup.type").get();
    types[type](type);
  });


  button.set_bubble_url(opt("popup.type").map((type) =>
                          (type === "bubble"
                            ? panel_url
                            : null)));
});
