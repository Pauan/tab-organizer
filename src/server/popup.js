import * as list from "../util/list";
import * as ref from "../util/ref";
import * as event from "../util/event";
import * as record from "../util/record";
import * as async from "../util/async";
import { init as init_chrome } from "../chrome/server";
import { init as init_options } from "./options";
import { uuid_port_popup } from "../common/uuid";
import { assert, crash } from "../util/assert";


export const init = async.all([init_chrome,
                               init_options],
                              ({ manifest, button, popups,
                                 tabs, windows, ports },
                               { get: opt }) => {

  button.set_tooltip(ref.always(record.get(manifest, "name")));

  const panel_url = "panel.html";
  const empty_url = "data/empty.html";

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
      popups.close(popup.value);
    }

    cleanup_popup();
  };

  const close_panel = () => {
    if (panel.value !== null) {
      popups.close(panel.value);
    }

    cleanup_panel();
  };

  const close_tab = () => {
    if (tab.value !== null) {
      tabs.close(tab.value);
    }

    cleanup_tab();
  };


  // TODO test this
  const get_monitor_size = (f) => {
    // In Chrome (on Linux only?), screen.avail doesn't work, so we fall back
    // to the old approach of "create a maximized window then check its size"
    // TODO creating a maximized window and checking its size causes it to be off by 1, is this true only on Linux?
    popups.open({
      url: empty_url,
      focused: false
    }, (x) => {
      popups.maximize(x);

      // TODO Yes we really need this delay, because Chrome is stupid
      setTimeout(() => {
        popups.get_size(x, (size) => {
          // TODO rather than closing the popup, how about instead re-using it for the popup/sidebar ?
          popups.close(x);
          f(size);
        });
      }, 500);
    });
  };

  const set_monitor_size = (size) => {
    ref.set(opt("screen.available.left"), size.left);
    ref.set(opt("screen.available.top"), size.top);
    ref.set(opt("screen.available.width"), size.width);
    ref.set(opt("screen.available.height"), size.height);
    ref.set(opt("screen.available.checked"), true);
  };

  const get_screen_size = (f) => {
    if (ref.get(opt("screen.available.checked"))) {
      f({
        left:   ref.get(opt("screen.available.left")),
        top:    ref.get(opt("screen.available.top")),
        width:  ref.get(opt("screen.available.width")),
        height: ref.get(opt("screen.available.height"))
      });

    } else {
      get_monitor_size((size) => {
        set_monitor_size(size);
        f(size);
      });
    }
  };

  const resize_window = (window) => {
    assert(popup.windows !== null);

    // TODO only do this if the state is "normal" or "maximized" ?
    windows.move(window, popup.windows);
  };

  const unresize_window = (window) => {
    assert(popup.windows !== null);

    // TODO only do this if the state is "normal" ?
    windows.maximize(window);
  };

  const resize_windows = () => {
    assert(popup.windows !== null);

    list.each(windows.get_all(), resize_window);
  };

  const unresize_windows = () => {
    if (popup.windows !== null) {
      list.each(windows.get_all(), unresize_window);

      popup.windows = null;
    }
  };

  const get_popup_dimensions = (type, screen) => {
    switch (type) {
    case "popup":
      const popup_left   = ref.get(opt("size.popup.left"));
      const popup_top    = ref.get(opt("size.popup.top"));
      const popup_width  = ref.get(opt("size.popup.width"));
      const popup_height = ref.get(opt("size.popup.height"));

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
      const sidebar_position = ref.get(opt("size.sidebar.position"));
      const sidebar_size     = ref.get(opt("size.sidebar"));

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
      crash();
    }
  };

  const get_window_size = (screen) => {
    const sidebar_position = ref.get(opt("size.sidebar.position"));
    const sidebar_size     = ref.get(opt("size.sidebar"));

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
        // TODO this has to be before open_popup because of a bug in Chrome
        //      where moving a window causes it to be focused. In addition,
        //      we can't do it in parallel with open_popup, for that same reason
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
        popups.move(popup.value, dimensions);
        popups.focus(popup.value);
      }
    });
  };


  const open_panel = () => {
    close_popup();
    close_tab();

    const dimensions = {
      width:  ref.get(opt("size.panel.width")),
      height: ref.get(opt("size.panel.height"))
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
      popups.move(panel.value, dimensions);
      popups.focus(panel.value);
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
      tabs.focus(tab.value);
    }
  };


  const open_bubble = () => {
    close_popup();
    close_panel();
    close_tab();
  };


  const types = record.make({
    "popup": open_popup,
    "panel": open_panel,
    "sidebar": open_popup,
    "tab": open_tab
  });


  event.on_receive(popups.on_close, (x) => {
    if (panel.value !== null && panel.value === x) {
      cleanup_panel();
    }

    if (popup.value !== null && popup.value === x) {
      cleanup_popup();
    }
  });


  event.on_receive(tabs.on_close, (x) => {
    if (tab.value !== null && tab.value === x.tab) {
      cleanup_tab();
    }
  });


  event.on_receive(windows.on_open, ({ window }) => {
    // TODO test this
    if (popup.windows !== null) {
      resize_window(window);
    }
  });


  event.on_receive(button.on_click, () => {
    const type = ref.get(opt("popup.type"));
    record.get(types, type)(type);
  });


  const handle_events = record.make({
    "open-panel": () => {
      if (ref.get(opt("popup.type")) === "bubble") {
        open_bubble();
      }
    },

    "get-monitor-size": (port) => {
      get_monitor_size((size) => {
        set_monitor_size(size);

        ports.send(port, record.make({
          "type": "set-monitor-size"
        }));
      });
    }
  });

  ports.on_open(uuid_port_popup, (port) => {
    ports.on_receive(port, (x) => {
      record.get(handle_events, record.get(x, "type"))(port);
    });
  });


  button.set_bubble_url(ref.map(opt("popup.type"), (type) =>
                          (type === "bubble"
                            ? panel_url
                            : null)));


  return async.done({});
});
