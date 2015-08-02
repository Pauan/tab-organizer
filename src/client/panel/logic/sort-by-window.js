import { List } from "../../../util/mutable/list";
import { Record } from "../../../util/mutable/record";
import { Ref } from "../../../util/mutable/ref";
import { each } from "../../../util/iterator";
import { search } from "../search/search";


export const make = () => {
  const groups = new List();

  const make_group = (window) =>
    new Record({
      "id": window.get("id"),
      "name": window.get("name"),
      "tabs": window.get("tabs"),

      // TODO a little hacky
      "first-selected-tab": null,

      "matches": new Ref(false),
      "height": new Ref(null)
    });

  const init = (windows) => {
    each(windows, (window) => {
      groups.push(make_group(window));
    });

    search(groups);
  };

  const tab_open = () => {
    // TODO can this be made more efficient ?
    search(groups);
  };

  const tab_focus = () => {};

  const tab_unfocus = () => {};

  const tab_update = () => {
    // TODO can this be made more efficient ?
    search(groups);
  };

  const tab_move = () => {
    // TODO is this correct ?
    // TODO can this be made more efficient ?
    search(groups);
  };

  const tab_close = () => {
    // TODO can this be made more efficient ?
    search(groups);
  };

  const window_open = (window, index) => {
    groups.insert(index, make_group(window));
    // TODO can this be made more efficient ?
    search(groups);
  };

  const window_close = (window, index) => {
    groups.remove(index);
    // TODO can this be made more efficient ?
    search(groups);
  };

  return { groups, init, tab_open, tab_focus, tab_unfocus, tab_update,
           tab_move, tab_close, window_open, window_close };
};
