import { uuid_port_tab } from "../common/uuid";
//import { on_connect } from "../server/port";
import { init_chrome, windows, open_window,
         event_window_open, event_window_close,
         event_window_focus, event_tab_open,
         event_tab_focus, event_tab_close,
         event_tab_replace } from "../chrome/server";
import { each } from "../util/iterator";
import { async, delay } from "../util/async";

export const init_windows = async(function* () {
  yield init_chrome;

  each(windows, (window) => {
    console.log("init", window);
  });

  event_window_open.on((info) => {
    console.log("window open", info);
  });

  event_window_close.on((info) => {
    console.log("window close", info);
  });

  event_window_focus.on((info) => {
    console.log("window focus", info);
  });

  event_tab_open.on((info) => {
    console.log("tab open", info);
  });

  event_tab_focus.on((info) => {
    console.log("tab focus", info);
  });

  event_tab_close.on((info) => {
    console.log("tab close", info);
  });

  event_tab_replace.on((info) => {
    console.log("tab replace", info);
  });

  /*const window = yield open_window({});

  console.log(window);
  console.log(yield window.get_state());
  console.log(yield window.get_dimensions());

  console.log(yield window.set_state("maximized"));
  console.log(yield delay(1000));
  console.log(yield window.set_state("normal"));
  console.log(yield delay(1000));
  console.log(yield window.set_dimensions({ left: 50, width: 100, height: 50 }));
  console.log(yield delay(1000));
  console.log(yield window.get_dimensions());
  console.log(yield window.set_state("maximized"));
  console.log(yield delay(1000));
  console.log(yield window.get_state());
  console.log(yield window.close());*/
});
