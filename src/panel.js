import { sync as sync_tabs } from "./client/sync/tabs";
import { run_async } from "./util/async";
import { observe } from "./util/ref";
import * as dom from "./client/dom";

import { map } from "./util/iterator";


run_async(function* () {
  const { windows, window_ids, tab_ids } = yield sync_tabs;

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

  const render = (windows, window_ids, tab_ids) => {
    dom.render(view(windows, window_ids, tab_ids));
  };

  observe(render, windows, window_ids, tab_ids);

  console["debug"]("panel: initialized");
});
