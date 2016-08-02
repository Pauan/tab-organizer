import * as list from "../util/list";
import * as mutable from "../util/mutable";
import * as event from "../util/event";
import * as async from "../util/async";
import * as maybe from "../util/maybe";
import { init as init_chrome } from "../chrome/server";
import { init as init_windows } from "./windows";
import { init as init_options } from "./options";


export const init = async.all([init_chrome,
                               init_windows,
                               init_options],
                              ({ button },
                               { get_all_tabs, on_tab_open, on_tab_close },
                               { get: opt }) => {

  const loaded   = mutable.make(0);
  const unloaded = mutable.make(0);

  const add1 = (x) => x + 1;
  const sub1 = (x) => x - 1;

  const add = (x, y) =>
    (x === null
      ? y
      : (y === null
          ? x
          : x + y));

  list.each(get_all_tabs(), ({ transient }) => {
    if (maybe.has(transient)) {
      mutable.modify(loaded, add1);
    } else {
      mutable.modify(unloaded, add1);
    }
  });

  event.on_receive(on_tab_open, ({ transient }) => {
    if (maybe.has(transient)) {
      mutable.modify(loaded, add1);
    } else {
      mutable.modify(unloaded, add1);
    }
  });

  // TODO handle a tab transitioning from loaded to unloaded, and vice versa
  event.on_receive(on_tab_close, ({ transient }) => {
    if (maybe.has(transient)) {
      mutable.modify(loaded, sub1);
    } else {
      mutable.modify(unloaded, sub1);
    }
  });


  button.set_text(mutable.latest([
    opt("counter.display.loaded"),
    opt("counter.display.unloaded"),
    loaded,
    unloaded
  ], (is_loaded, is_unloaded, loaded, unloaded) => {
    const x1 = (is_loaded ? loaded : null);
    const x2 = (is_unloaded ? unloaded : null);
    const x3 = add(x1, x2);

    if (x3 === null) {
      return null;
    } else {
      return "" + x3;
    }
  }));

  button.set_color(mutable.always({
    red: 0,
    green: 0,
    blue: 0,
    alpha: 0.9
  }));


  return async.done({});
});
