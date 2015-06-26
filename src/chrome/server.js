import { each } from "../util/iterator";
import { async, concurrent } from "../util/async";
import { async_chrome } from "./common/util";
import { make_window } from "./server/windows";
import { make_popup } from "./server/popups";
import "./server/events";

export { windows,
         open_window,
         event_window_open,
         event_window_close,
         event_window_focus } from "./server/windows";
export { event_tab_open,
         event_tab_close,
         event_tab_focus,
         event_tab_replace } from "./server/tabs";
export { on_connect,
         ports,
         send } from "./server/port";


// TODO do I need to wait for the "load" event before doing this ?
export const init_windows = async(function* () {
  const a = yield async_chrome(chrome["windows"]["getAll"], { "populate": true });

  each(a, (info) => {
    make_window(info, false);
    make_popup(info, false);
  });
});

export const init_chrome = async(function* () {
  yield concurrent(init_windows);
});
