import { init as init_tabs } from "../../sync/tabs";
import { async } from "../../../util/async";
import { List } from "../../../util/mutable/list";
import { Record } from "../../../util/mutable/record";
import { Ref } from "../../../util/mutable/ref";
import { each, indexed } from "../../../util/iterator";
import { assert } from "../../../util/assert";
import { search, value, matches } from "../search/search";
import { update_groups, update_tabs } from "../logic/general";


const make_group = (window) =>
  new Record({
    // Standard properties
    "tabs": new List(),
    "header-name": new Ref(window.get("name")),
    "focused": new Ref(false),
    // TODO a little hacky
    "first-selected-tab": null,
    "visible": new Ref(false), // TODO is this correct ?
    "height": new Ref(null),
    "index": null, // TODO a little bit hacky

    // Non-standard properties
    "id": window.get("id"),
    "name": window.get("name"),
  });

const make_tab = (tab) =>
  new Record({
    // Standard properties
    "url": new Ref(tab.get("url")),
    "title": new Ref(tab.get("title")),
    "favicon": new Ref(tab.get("favicon")),

    "focused": new Ref(tab.get("focused")),
    "unloaded": new Ref(tab.get("unloaded")),

    "selected": new Ref(false),
    "visible": new Ref(false), // TODO use `matches(tab)` ?
    "animate": new Ref(false),
    "top": new Ref(null),
    "index": null, // TODO a little bit hacky

    // Non-standard properties
    "id": tab.get("id"),
  });

// TODO this can be more efficient if it's given a starting index
// TODO inefficient; this should be combined with `update_groups` in some way
const update_group_names = (groups) => {
  update_groups(groups);

  each(indexed(groups), ([i, group]) => {
    if (group.get("name") === null) {
      group.get("header-name").set("" + (i + 1));
    }
  });
};


export const init = async(function* () {
  const { windows, on_change } = yield init_tabs;

  const make = () => {
    const groups = new List();
    const group_ids = new Record();
    const tab_ids = new Record();


    const new_group = (window) => {
      const group = make_group(window);

      const tabs = group.get("tabs");

      each(window.get("tabs"), (tab) => {
        const x = new_tab(tab);
        tabs.push(x);
      });

      update_tabs(group);

      group_ids.insert(group.get("id"), group);

      return group;
    };

    const new_tab = (tab) => {
      const x = make_tab(tab);

      tab_ids.insert(x.get("id"), x);

      return x;
    };


    const types = {
      "tab-open": ({ tab, window, index }) => {
        const group = group_ids.get(window.get("id"));

        const x = new_tab(tab);
        group.get("tabs").insert(index, x);

        update_tabs(group);

        search(groups);
      },


      "tab-focus": ({ tab }) => {
        const x = tab_ids.get(tab.get("id"));

        x.get("focused").set(true);
      },


      "tab-unfocus": ({ tab }) => {
        const x = tab_ids.get(tab.get("id"));

        x.get("focused").set(false);
      },


      "tab-update": ({ tab, old }) => {
        const x = tab_ids.get(tab.get("id"));

        x.get("url").set(tab.get("url"));
        x.get("title").set(tab.get("title"));
        x.get("favicon").set(tab.get("favicon"));

        search(groups);
      },


      "tab-move": ({ tab, old_window, new_window, old_index, new_index }) => {
        const old_group = group_ids.get(old_window.get("id"));
        const new_group = group_ids.get(new_window.get("id"));
        const old_tabs = old_group.get("tabs");
        const new_tabs = new_group.get("tabs");
        const x = tab_ids.get(tab.get("id"));

        assert(old_tabs.get(old_index) === x);

        old_tabs.remove(old_index);
        new_tabs.insert(new_index, x);

        // TODO test this
        if (old_group === new_group) {
          update_tabs(old_group);

        } else {
          update_tabs(old_group);
          update_tabs(new_group);
        }

        // TODO is this needed ?
        search(groups);
      },


      "tab-close": ({ tab, window, index }) => {
        const group = group_ids.get(window.get("id"));
        const tabs = group.get("tabs");
        const x = tab_ids.get(tab.get("id"));

        tab_ids.remove(x.get("id"));

        assert(tabs.get(index) === x);
        tabs.remove(index);

        // TODO what if `tabs.size` is 0 ?
        update_tabs(group);

        // This is needed in order for animations to
        // properly play when removing a group
        if (tabs.size === 0) {
          group_ids.remove(group.get("id"));
          // TODO can this be made more efficient ?
          groups.remove(groups.index_of(group).get());
          update_group_names(groups);
        }

        // TODO is this needed ?
        search(groups);
      },


      "window-open": ({ window, index }) => {
        const group = new_group(window);

        groups.insert(index, group);
        update_group_names(groups);

        search(groups);
      },


      "window-close": ({ window, index }) => {
        const id = window.get("id");

        if (group_ids.has(id)) {
          const group = group_ids.get(id);

          group_ids.remove(group.get("id"));

          assert(groups.get(index) === group);
          groups.remove(index);

          update_group_names(groups);
        }
      }
    };


    const stop1 = on_change((x) => {
      types[x.type](x);
    });

    const stop2 = value.on_change(() => {
      search(groups);
    });


    each(windows, (window) => {
      const group = new_group(window);
      groups.push(group);
    });

    update_group_names(groups);
    search(groups);


    // TODO test this
    const stop = () => {
      stop1.stop();
      stop2.stop();
    };

    return { groups, stop };
  };


  return { make };
});
