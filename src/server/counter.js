import { init as init_chrome } from "../chrome/server";
import { init as init_windows } from "./windows";
import { init as init_options } from "./options";
import { each } from "../util/iterator";
import { always, latest, Ref } from "../util/ref";
import { assert, fail } from "../util/assert";
import { async } from "../util/async";


export const init = async([init_chrome,
                           init_windows,
                           init_options],
                          ({ button },
                           { get_all_tabs, on_tab_open, on_tab_close },
                           { get: opt }) => {

  const loaded   = new Ref(0);
  const unloaded = new Ref(0);

  const add1 = (x) => x + 1;
  const sub1 = (x) => x - 1;

  const add = (x, y) =>
    (x === null
      ? y
      : (y === null
          ? x
          : x + y));

  each(get_all_tabs(), ({ tab, transient }) => {
    if (transient !== null) {
      loaded.modify(add1);
    } else {
      unloaded.modify(add1);
    }
  });

  on_tab_open(({ tab, transient }) => {
    if (transient !== null) {
      loaded.modify(add1);
    } else {
      unloaded.modify(add1);
    }
  });

  // TODO handle a tab transitioning from loaded to unloaded, and vice versa
  on_tab_close(({ tab, transient }) => {
    if (transient !== null) {
      loaded.modify(sub1);
    } else {
      unloaded.modify(sub1);
    }
  });


  button.set_text(latest([
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

  button.set_color(always({ red: 0, green: 0, blue: 0, alpha: 0.9 }));
});
