import { uuid_port_tab } from "../common/uuid";
//import { on_connect } from "../server/port";
import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { each } from "../util/iterator";
import { async } from "../util/async";


export const init = async(function* () {
  const { windows } = yield init_chrome;
  const session = yield init_session;

  each(windows.get_windows(), (window) => {
    console.log("init", window);
  });

  windows.on_window_open.listen((info) => {
    session.window_open(info);
    console.log("window open", info);
  });

  windows.on_window_close.listen((info) => {
    session.window_close(info);
    console.log("window close", info);
  });

  windows.on_window_focus.listen((info) => {
    console.log("window focus", info);
  });

  windows.on_tab_open.listen((info) => {
    session.tab_open(info);
    console.log("tab open", info);
  });

  windows.on_tab_focus.listen((info) => {
    console.log("tab focus", info);
  });

  windows.on_tab_close.listen((info) => {
    session.tab_close(info);
    console.log("tab close", info);
  });

  windows.on_tab_move.listen((info) => {
    session.tab_move(info);
    console.log("tab move", info);
  });

  windows.on_tab_update.listen((info) => {
    session.tab_update(info);
    console.log("tab update", info);
  });

  windows.on_tab_replace.listen((info) => {
    tab_replace(info);
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
