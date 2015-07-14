import { init as init_sync } from "./client/sync";
import { run_async } from "./util/async";
import { Timer } from "./util/time";
import { assert } from "./util/assert";
import { any, each, map } from "./util/iterator";
import { Some, None } from "./util/immutable/maybe";
import { empty } from "./util/stream";
import { ui_tab } from "./client/panel/tab";
import * as dom from "./client/dom";


run_async(function* () {
  const db = yield init_sync;

  const view_window_style = dom.style({
    "border": "5px solid black"
  });

  const view_window = (window, tab_ids) =>
    dom.col((e) => {
      e.add_style(view_window_style);

      each(window.get("tabs"), (tab_id) => {
        e.push(ui_tab(tab_ids.get(tab_id)));
      });

      return empty;
    });

  const view = (windows, window_ids, tab_ids) =>
    dom.col((e) => {
      each(windows, (window_id) => {
        e.push(view_window(window_ids.get(window_id), tab_ids));
      });

      return empty;
    });

  const render = ([windows, window_ids, tab_ids]) => {
    const timer = new Timer();
    dom.main.clear();
    dom.main.push(view(windows, window_ids, tab_ids));
    timer.done();

    console["debug"]("ui: rendered (" + timer.diff() + "ms)");
  };

  const get = (keys) =>
    [...map(keys, (key) => db.get([key]))];

  // TODO test this
  const observe = (keys) =>
    db.on_commit.keep((transaction) =>
      any(transaction, (x) => {
        const key = x.get("keys").get(0);
        return any(keys, (s) => s === key);
      })).accumulate(get(keys), (x, y) => get(keys));

  observe([
    "current.windows",
    "current.window-ids",
    "current.tab-ids"
  ]).each(render);

  console["debug"]("panel: initialized");
});
