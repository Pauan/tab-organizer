import { uuid_port_tab } from "./common/uuid";
import { init as init_chrome } from "./chrome/client";
import { run_async } from "./util/async";

import { each } from "./util/iterator";
import { fail } from "./util/assert";

run_async(function* () {
  const { port } = yield init_chrome;

  const x = port.connect(uuid_port_tab);

  x.on_receive.listen((message) => {
    switch (message.get("type")) {
    case "init":
      const windows = message.get("windows");
      const window_ids = message.get("window-ids");
      const tab_ids = message.get("tab-ids");

      each(windows, (window_id) => {
        const window = window_ids.get(window_id);

        const ui_window = document["createElement"]("div");

        each(window.get("tabs"), (tab_id) => {
          const tab = tab_ids.get(tab_id);

          const ui_tab = document["createElement"]("div");

          ui_tab["textContent"] = tab.get("title") || tab.get("url");

          ui_window["appendChild"](ui_tab);
        });

        document["body"]["appendChild"](ui_window);
      });

      break;

    default:
      fail();
    }
  });

  console["debug"]("panel: initialized");
});
