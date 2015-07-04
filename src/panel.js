import { sync as sync_tabs } from "./client/sync/tabs";
import { run_async } from "./util/async";
import { Timer } from "./util/time";
import { map } from "./util/iterator";
import * as dom from "./client/dom";


run_async(function* () {
  const { table } = yield sync_tabs;

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
    const windows    = table.get("windows");
    const window_ids = table.get("window-ids");
    const tab_ids    = table.get("tab-ids");

    const timer = new Timer();
    dom.render(view(windows, window_ids, tab_ids));
    timer.done();

    console["debug"]("ui: rendered (" + timer.diff() + "ms)");
  };

  render();

  table.on_change.listen((x) => {
    render();
  });

  console["debug"]("panel: initialized");
});
