import { init as init_sync } from "./client/sync";
import { run_async } from "./util/async";
import { Timer } from "./util/time";
import { any, map } from "./util/iterator";
import * as dom from "./client/dom";


run_async(function* () {
  const db = yield init_sync;

  const view_tab = (tab) =>
    dom.div({},
      [tab.get("title") || tab.get("url")]);

  const view_window = (window, tab_ids) =>
    dom.div({},
      map(window.get("tabs"), (tab_id) =>
        view_tab(tab_ids.get(tab_id))));

  const view = (windows, window_ids, tab_ids) =>
    dom.div({},
      map(windows, (window_id) =>
        view_window(window_ids.get(window_id), tab_ids)));

  const render = () => {
    const windows    = db.get(["current.windows"]);
    const window_ids = db.get(["current.window-ids"]);
    const tab_ids    = db.get(["current.tab-ids"]);

    const timer = new Timer();
    dom.render(view(windows, window_ids, tab_ids));
    timer.done();

    console["debug"]("ui: rendered (" + timer.diff() + "ms)");
  };

  render();

  db.on_change.listen((transaction) => {
    const should_render = any(transaction, (x) => {
      const key = x.get("key").get(0);

      return key === "current.windows"    ||
             key === "current.window-ids" ||
             key === "current.tab-ids";
    });

    if (should_render) {
      render();
    }
  });

  console["debug"]("panel: initialized");
});
