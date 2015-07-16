import { init as init_sync } from "./client/sync";
import { run_async } from "./util/async";
import { Timer } from "./util/time";
import { each } from "./util/iterator";
import { empty, latest } from "./util/stream";
import { ui_tab } from "./client/panel/tab";
import * as dom from "./client/dom";


run_async(function* () {
  const db = yield init_sync;

  const view_window_style = dom.style({
    "border": "5px solid black"
  });

  const view_window = (db, window_id) =>
    dom.col((e) => {
      const window = db.get(["current.window-ids", window_id]);

      e.add_style(view_window_style);

      each(window.get("tabs"), (tab_id) => {
        e.push(ui_tab(db, tab_id, true));
      });

      return empty;
    });

  const view = (db) =>
    dom.col((e) => {
      const windows = db.get(["current.windows"]);

      each(windows, (window_id) => {
        e.push(view_window(db, window_id));
      });

      return empty;
    });

  const render = (db) => {
    const timer = new Timer();

    dom.main.clear();
    dom.main.push(view(db));

    timer.done();

    console["debug"]("ui: rendered (" + timer.diff() + "ms)");
  };

  // TODO should this use `latest` or `merge` ?
  latest([
    db.ref(["current.windows"]),
    db.ref(["current.window-ids"]),
    db.ref(["current.tab-ids"])
  ]).each(() => {
    render(db);
  });

  console["debug"]("panel: initialized");
});
