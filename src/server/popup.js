import { init as init_chrome } from "../chrome/server";
import { init as init_options } from "./options";
import { async } from "../util/async";
import { always } from "../util/ref";
import { each } from "../util/iterator";
import { assert, fail } from "../util/assert";


export const init = async([init_chrome,
                           init_options],
                          ({ manifest, button, popups, tabs, windows },
                           { get: opt }) => {

  button.set_tooltip(always(manifest.get("name")));

  const panel_url = "panel.html";

  const popup = {
    open: false,
    value: null,
    windows: null
  };

  const panel = {
    open: false,
    value: null
  };

  const tab = {
    open: false,
    value: null
  };


  const cleanup_popup = () => {
    popup.open = false;
    popup.value = null;

    // TODO test this
    unresize_windows();
  };

  const cleanup_panel = () => {
    panel.open = false;
    panel.value = null;
  };

  const cleanup_tab = () => {
    tab.open = false;
    tab.value = null;
  };


  const close_popup = () => {
    if (popup.value !== null) {
      popup.value.close();
    }

    cleanup_popup();
  };

  const close_panel = () => {
    if (panel.value !== null) {
      panel.value.close();
    }

    cleanup_panel();
  };

  const close_tab = () => {
    if (tab.value !== null) {
      tab.value.close();
    }

    cleanup_tab();
  };


  const get_screen_size = (f) => {
    f({
      left:   opt("screen.available.left").get(),
      top:    opt("screen.available.top").get(),
      width:  opt("screen.available.width").get(),
      height: opt("screen.available.height").get()
    });
  };

  const resize_window = (window) => {
    assert(popup.windows !== null);

    // TODO only do this if the state is "normal" or "maximized" ?
    window.move(popup.windows);
  };

  const unresize_window = (window) => {
    assert(popup.windows !== null);

    // TODO only do this if the state is "normal" ?
    window.maximize();
  };

  const resize_windows = () => {
    assert(popup.windows !== null);

    console.log(popup.windows);
    each(windows.get(), resize_window);
  };

  const unresize_windows = () => {
    if (popup.windows !== null) {
      each(windows.get(), unresize_window);

      popup.windows = null;
    }
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

      // TODO test this
      if (type === "sidebar") {
        popup.windows = get_window_size(screen);
        resize_windows();

      // TODO test this
      } else {
        unresize_windows();
      }

      if (popup.value === null) {
        // TODO test this
        if (!popup.open) {
          popup.open = true;

          popups.open({
            url: panel_url,
            left: dimensions.left,
            top: dimensions.top,
            width: dimensions.width,
            height: dimensions.height
          }, (x) => {
            popup.value = x;

            // TODO test this
            if (!popup.open) {
              close_popup();
            }
          });
        }

      // TODO test this
      } else {
        popup.value.move(dimensions);
        popup.value.focus();
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

    if (panel.value === null) {
      // TODO test this
      if (!panel.open) {
        panel.open = true;

        popups.open({
          type: "panel",
          url: panel_url,
          width: dimensions.width,
          height: dimensions.height
        }, (x) => {
          panel.value = x;

          // TODO test this
          if (!panel.open) {
            close_panel();
          }
        });
      }

    } else {
      panel.value.move(dimensions);
      panel.value.focus();
    }
  };


  const open_tab = () => {
    close_popup();
    close_panel();

    if (tab.value === null) {
      // TODO test this
      if (!tab.open) {
        tab.open = true;

        tabs.open({
          url: panel_url
        }, (x) => {
          tab.value = x;

          // TODO test this
          if (!tab.open) {
            close_tab();
          }
        });
      }

    } else {
      tab.value.focus();
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
    if (panel.value !== null && panel.value === x) {
      cleanup_panel();
    }

    if (popup.value !== null && popup.value === x) {
      cleanup_popup();
    }
  });


  tabs.on_close((x) => {
    if (tab.value !== null && tab.value === x.tab) {
      cleanup_tab();
    }
  });


  windows.on_open((x) => {
    // TODO test this
    if (popup.windows !== null) {
      resize_window(x.window);
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
