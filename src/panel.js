import { init as init_sync } from "./client/sync";
import { run_async } from "./util/async";
import { Timer } from "./util/time";
import { assert } from "./util/assert";
import { keep_map, any, each } from "./util/iterator";
import { Some, None } from "./util/immutable/maybe";
import { ui_tab } from "./client/panel/tab";
import * as dom from "./client/dom";


run_async(function* () {
  const db = yield init_sync;

  const view_window_style = dom.style({
    "border": "1px solid black"
  });

  const view_window = (window, tab_ids) =>
    dom.col((e) => {
      e.add_style(view_window_style);

      each(window.get("tabs"), (tab_id) => {
        e.push(ui_tab(tab_ids.get(tab_id)));
      });
    });

  const view = (windows, window_ids, tab_ids) =>
    dom.col((e) => {
      each(windows, (window_id) => {
        e.push(view_window(window_ids.get(window_id), tab_ids));
      });
    });

  const render = ({ windows, window_ids, tab_ids }) => {
    const timer = new Timer();
    dom.main.clear();
    dom.main.push(view(windows, window_ids, tab_ids));
    timer.done();

    console["debug"]("ui: rendered (" + timer.diff() + "ms)");
  };

  render();

  const changes = db.on_commit.keep_map((transaction) => {
    const should_render = any(transaction, (x) => {
      const key  = x.get("keys").get(0);

      return key === "current.windows"    ||
             key === "current.window-ids" ||
             key === "current.tab-ids";
    });

    if (should_render) {
      return Some({
        windows:    db.get("current.windows"),
        window_ids: db.get("current.window-ids"),
        tab_ids:    db.get("current.tab-ids")
      });

    } else {
      return None;
    }
  });

  changes.each((x) => {
    render(x);
  });

  console["debug"]("panel: initialized");
});
