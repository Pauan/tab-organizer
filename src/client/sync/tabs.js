import { uuid_port_tab } from "../../common/uuid";
import { ports } from "../../chrome/client";
import { async, async_callback } from "../../util/async";
import { Event } from "../../util/event";
import { Record } from "../../util/mutable/record";
import { List } from "../../util/mutable/list";
import { each, indexed, map, to_array,  } from "../../util/iterator";
import { assert } from "../../util/assert";
import { Timer } from "../../util/time";


const timer = new Timer();

export const init = async(function* () {
  const port       = ports.connect(uuid_port_tab);
  const windows    = new List();
  const window_ids = new Record();
  const tab_ids    = new Record();
  const events     = Event();

  const make_window = ({ "id": id,
                         "name": name }) =>
    new Record({
      "id": id,
      "name": name,
      "tabs": new List(),
    });

  const make_tab = ({ "id": id,
                      "url": url,
                      "time": time,
                      "title": title,
                      "favicon": favicon,
                      "pinned": pinned,
                      "focused": focused,
                      "unloaded": unloaded },
                    window) =>
    new Record({
      "id": id,
      "window": window,
      "time": new Record(time),

      "url": url,
      "title": title || url || "",
      "favicon": favicon,
      "pinned": pinned,

      "focused": focused,
      "unloaded": unloaded,
    });


  const close_tabs = (a) => {
    port.send({
      "type": "close-tabs",
      "tabs": to_array(map(a, (tab) => tab.get("id")))
    });
  };

  const focus_tab = (tab) => {
    port.send({
      "type": "focus-tab",
      "tab-id": tab.get("id")
    });
  };


  yield async_callback((success, error) => {
    const types = {
      "init": ({ "windows": _windows }) => {

        each(_windows, (info) => {
          const window = make_window(info);

          const tabs = window.get("tabs");

          each(info["tabs"], (info) => {
            const tab = make_tab(info, window);

            tab_ids.insert(tab.get("id"), tab);

            tabs.push(tab);
          });

          window_ids.insert(window.get("id"), window);

          windows.push(window);
        });

        success(undefined);
      },

      "tab-open": ({ "tab": info,
                     "window-id": window_id,
                     "tab-index": index }) => {

        const window = window_ids.get(window_id);
        const tabs = window.get("tabs");

        const tab = make_tab(info, window);

        tab_ids.insert(tab.get("id"), tab);

        tabs.insert(index, tab);

        events.send({
          type: "tab-open",
          window: window,
          tab: tab,
          index: index
        });
      },

      "tab-focus": ({ "tab-id": id,
                      "tab-time-focused": time_focused }) => {

        const tab = tab_ids.get(id);

        tab.update("focused", true);
        // TODO test this
        tab.get("time").assign("focused", time_focused);

        events.send({
          type: "tab-focus",
          tab: tab
        });
      },

      "tab-unfocus": ({ "tab-id": id }) => {
        const tab = tab_ids.get(id);

        tab.update("focused", false);

        events.send({
          type: "tab-unfocus",
          tab: tab
        });
      },

      "tab-update": ({ "tab-id": id,
                       "tab": { "url": url,
                                "title": title,
                                "favicon": favicon,
                                "pinned": pinned,
                                "time": time } }) => {

        const tab = tab_ids.get(id);

        const old = new Record({
          "url": tab.get("url"),
          "title": tab.get("title"),
          "favicon": tab.get("favicon"),
          "pinned": tab.get("pinned"),
          "time": tab.get("time")
        });

        // TODO code duplication
        tab.update("url", url);
        tab.update("title", title || url || "");
        tab.update("favicon", favicon);
        tab.update("pinned", pinned);
        tab.update("time", new Record(time));

        events.send({
          type: "tab-update",
          tab: tab,
          old: old
        });
      },

      "tab-move": ({ "window-old-id": old_window_id,
                     "window-new-id": new_window_id,
                     "tab-old-index": old_index,
                     "tab-new-index": new_index,
                     "tab-id": tab_id }) => {

        const old_window = window_ids.get(old_window_id);
        const new_window = window_ids.get(new_window_id);
        const old_tabs = old_window.get("tabs");
        const new_tabs = new_window.get("tabs");
        const tab = tab_ids.get(tab_id);

        assert(tab.get("window") === old_window);
        tab.update("window", new_window);

        assert(old_tabs.get(old_index) === tab);

        old_tabs.remove(old_index);
        new_tabs.insert(new_index, tab);

        events.send({
          type: "tab-move",
          tab: tab,
          old_window: old_window,
          new_window: new_window,
          old_index: old_index,
          new_index: new_index
        });
      },

      "tab-close": ({ "window-id": window_id,
                      "tab-id": tab_id,
                      "tab-index": index }) => {

        const window = window_ids.get(window_id);
        const tab = tab_ids.get(tab_id);
        const tabs = window.get("tabs");

        tab.update("window", null);

        tab_ids.remove(tab.get("id"));

        assert(tabs.get(index) === tab);

        tabs.remove(index);

        events.send({
          type: "tab-close",
          window: window,
          tab: tab,
          index: index
        });
      },

      "window-open": ({ "window": info,
                        "window-index": index }) => {

        const window = make_window(info);

        assert(info["tabs"]["length"] === 0);

        window_ids.insert(window.get("id"), window);

        windows.insert(index, window);

        events.send({
          type: "window-open",
          window: window,
          index: index
        });
      },

      "window-close": ({ "window-id": window_id,
                         "window-index": index }) => {

        const window = window_ids.get(window_id);

        assert(window.get("tabs").size === 0);

        window_ids.remove(window.get("id"));

        assert(windows.get(index) === window);

        windows.remove(index);

        events.send({
          type: "window-close",
          window: window,
          index: index
        });
      }
    };

    port.on_receive((x) => {
      types[x["type"]](x);
    });
  });


  timer.done();
  console["debug"]("tabs: initialized (" + timer.diff() + "ms)");

  return { windows, on_change: events.receive, focus_tab, close_tabs };
});
