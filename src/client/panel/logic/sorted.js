import { init as init_tabs } from "../../sync/tabs";
import { async } from "../../../util/async";
import { SortedList } from "../../../util/mutable/list";
import { Record } from "../../../util/mutable/record";
import { Ref } from "../../../util/mutable/ref";
import { each } from "../../../util/iterator";
import { search, value } from "../search/search";


// TODO code duplication
const make_group = (id, data, name, sort_tabs) =>
  new Record({
    "id": id,
    "data": data,

    // Standard properties
    "tabs": new SortedList(sort_tabs),
    // TODO update the name periodically
    "header-name": new Ref(name),
    "focused": new Ref(false),
    // TODO a little hacky
    "first-selected-tab": null,
    "matches": new Ref(false), // TODO is this correct ?
    "height": new Ref(null)
  });

// TODO code duplication
const make_tab = (group, tab) =>
  new Record({
    "id": tab.get("id"),
    "time": tab.get("time"),
    "group": group,

    // Standard properties
    "url": new Ref(tab.get("url")),
    "title": new Ref(tab.get("title")),
    "favicon": new Ref(tab.get("favicon")),

    "focused": new Ref(tab.get("focused")),
    "unloaded": new Ref(tab.get("unloaded")),

    "matches": new Ref(false), // TODO use `matches(tab)` ?
    "selected": new Ref(false),
    "visible": new Ref(true),
    "animate": new Ref(false),
    "top": new Ref(null)
  });


export const make = ({ get_group_data,
                       get_group_name,
                       sort_groups,
                       sort_tabs }) =>
  async(function* () {
    const { windows, on_change } = yield init_tabs;

    const sort = (x, y) =>
      sort_groups(x.get("data"), y.get("data"));

    const make = () => {
      const groups = new SortedList(sort);
      const group_ids = new Record();
      const tab_ids = new Record();


      const get_group = (tab) => {
        const { id, data } = get_group_data(tab);

        if (group_ids.has(id)) {
          return group_ids.get(id);

        } else {
          const group = make_group(id, data, get_group_name(data), sort_tabs);

          group_ids.insert(id, group);
          groups.insert(group);

          return group;
        }
      };

      const remove_tab = (group, x) => {
        const tabs = group.get("tabs");

        tabs.remove(x);

        if (tabs.size === 0) {
          group_ids.remove(group.get("id"));
          groups.remove(group);
        }
      };

      const update_tab = (x, tab, f) => {
        const old_group = x.get("group");
        const new_group = get_group(tab);

        if (old_group === new_group) {
          f();

          // TODO can this be made more efficient ?
          old_group.get("tabs").change_sort(sort_tabs);


        } else {
          x.update("group", new_group);

          remove_tab(old_group, x);

          f();

          new_group.get("tabs").insert(x);
        }
      };

      const new_tab = (tab) => {
        const group = get_group(tab);
        const x = make_tab(group, tab);

        tab_ids.insert(x.get("id"), x);
        group.get("tabs").insert(x);

        return x;
      };


      const types = {
        "tab-open": ({ tab }) => {
          new_tab(tab);

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        "tab-focus": ({ tab }) => {
          const x = tab_ids.get(tab.get("id"));

          // TODO this is only needed for "focused"
          // TODO a little bit hacky
          // TODO update the timestamp for the tab ?
          // TODO update "focused" for the tab ?
          update_tab(x, tab, () => {});

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        "tab-unfocus": () => {},


        // TODO code duplication
        "tab-update": ({ tab }) => {
          const x = tab_ids.get(tab.get("id"));

          // TODO this is only needed for "title" and "url"
          // TODO a little bit hacky
          update_tab(x, tab, () => {
            // TODO remove + insert the tab if the URL is different ?
            x.get("url").set(tab.get("url"));
            x.get("title").set(tab.get("title"));
            x.get("favicon").set(tab.get("favicon"));
          });

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        "tab-move": () => {},


        "tab-close": ({ tab }) => {
          const x = tab_ids.get(tab.get("id"));
          const group = x.get("group");

          x.update("group", null);
          tab_ids.remove(x.get("id"));

          remove_tab(group, x);

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        "window-open": () => {},
        "window-close": () => {}
      };


      const stop1 = on_change((x) => {
        types[x.type](x);
      });

      const stop2 = value.on_change(() => {
        search(groups);
      });


      each(windows, (window) => {
        each(window.get("tabs"), (tab) => {
          new_tab(tab);
        });
      });

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
