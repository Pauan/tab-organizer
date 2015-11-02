import * as list from "../../../util/list";
import * as record from "../../../util/record";
import * as stream from "../../../util/stream";
import * as async from "../../../util/async";
import * as maybe from "../../../util/maybe";
import * as ref from "../../../util/ref";
import { assert, crash } from "../../../util/assert";
import { init as init_tabs } from "../../sync/tabs";
import { init as init_options } from "../../sync/options";
import { init as init_sort_by_window } from "./sort/window";
import { init as init_sort_by_tag } from "./sort/tag";
import { init as init_sort_by_created } from "./sort/created";
import { init as init_sort_by_focused } from "./sort/focused";
import { init as init_sort_by_title } from "./sort/title";
import { init as init_sort_by_url } from "./sort/url";


export const init = async.all([init_tabs,
                               init_options,
                               init_sort_by_window,
                               init_sort_by_tag,
                               init_sort_by_created,
                               init_sort_by_focused,
                               init_sort_by_title,
                               init_sort_by_url],
                              (tabs,
                               { get: opt },
                               { make: make_sort_by_window },
                               { make: make_sort_by_tag },
                               { make: make_sort_by_created },
                               { make: make_sort_by_focused },
                               { make: make_sort_by_title },
                               { make: make_sort_by_url }) => {

  /*const get_groups = ref.make((tab) => {
    const title = tab.get("title").value;
    return [title ? title[0] : ""];
  });*/

  /*const sort_tab = ref.make((tab1, tab2) => {
    const title1 = tab1.get("title").value;
    const title2 = tab2.get("title").value;

    if (title1 === title2) {
      return tab1.get("time").get("created") -
             tab2.get("time").get("created");

    } else if (title1 < title2) {
      return -1;
    } else {
      return 1;
    }
  });*/


  const click_tab = (group, tab) => {
    // TODO ew
    switch (ref.get(opt("tabs.click.type"))) {
    case "select-focus":
      if (ref.get(record.get(tab, "selected"))) {
        focus_tab(tab);

      } else {
        deselect_group(group);
        select_tab(group, tab);
      }
      break;

    case "focus":
      if (!ref.get(record.get(tab, "selected"))) {
        deselect_group(group);
      }

      focus_tab(tab);
      break;

    default:
      crash();
    }
  };


  const deselect_group = (group) => {
    record.update(group, "first-selected-tab", null);

    list.each(stream.current(record.get(group, "tabs")), (tab) => {
      ref.set(record.get(tab, "selected"), false);
    });
  };

  const select_tab = (group, tab) => {
    assert(record.get(group, "first-selected-tab") === null);
    assert(ref.get(record.get(tab, "selected")) === false);

    record.update(group, "first-selected-tab", tab);

    ref.set(record.get(tab, "selected"), true);
  };

  const ctrl_select_tab = (group, tab) => {
    ref.modify(record.get(tab, "selected"), (selected) => {
      if (selected) {
        record.update(group, "first-selected-tab", null);
        return false;

      } else {
        record.update(group, "first-selected-tab", tab);
        return true;
      }
    });
  };

  const shift_select_tab = (group, tab) => {
    const selected_tab = record.get(group, "first-selected-tab");

    if (selected_tab === null) {
      record.update(group, "first-selected-tab", tab);

      ref.set(record.get(tab, "selected"), true);


    } else if (tab === selected_tab) {
      list.each(stream.current(record.get(group, "tabs")), (x) => {
        ref.set(record.get(x, "selected"), x === tab);
      });


    // TODO put in assertions to verify that this is correct
    } else {
      let seen = 0;

      list.each(stream.current(record.get(group, "tabs")), (x) => {
        if (x === tab || x === selected_tab) {
          ref.set(record.get(x, "selected"), true);
          ++seen;

        } else if (seen === 1) {
          ref.set(record.get(x, "selected"), true);

        } else {
          ref.set(record.get(x, "selected"), false);
        }
      });
    }
  };


  const focus_tab = (tab) => {
    tabs.focus_tab(record.get(tab, "id"));
  };

  const close_tabs = (a) => {
    tabs.close_tabs(list.map(a, (tab) => record.get(tab, "id")));
  };


  // TODO a little bit hacky
  const groups = ref.make(null);

  let old = null;

  // TODO handle stop somehow ?
  ref.listen(opt("group.sort.type"), (type) => {
    // TODO test this
    if (old !== null) {
      old.stop();
    }

    if (type === "window") {
      old = make_sort_by_window();
      ref.set(groups, old.groups);

    } else if (type === "tag") {
      old = make_sort_by_tag();
      ref.set(groups, old.groups);

    } else if (type === "created") {
      old = make_sort_by_created();
      ref.set(groups, old.groups);

    } else if (type === "focused") {
      old = make_sort_by_focused();
      ref.set(groups, old.groups);

    } else if (type === "title") {
      old = make_sort_by_title();
      ref.set(groups, old.groups);

    } else if (type === "url") {
      old = make_sort_by_url();
      ref.set(groups, old.groups);

    } else {
      crash();
    }
  });


  return async.done({ groups, close_tabs, click_tab, focus_tab,
                      shift_select_tab, ctrl_select_tab });
});
