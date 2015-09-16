import * as record from "../../../util/record";
import * as running from "../../../util/running";
import * as functions from "../../../util/functions";
import * as list from "../../../util/list";
import * as async from "../../../util/async";
import * as stream from "../../../util/stream";
import * as event from "../../../util/event";
import * as ref from "../../../util/ref";
import { init as init_tabs } from "../../sync/tabs";
import { search, value } from "../search/search";
import { make_group, make_tab, update_groups, update_tabs } from "./general";


export const make = ({ get_group_data,
                       get_group_name,
                       sort_groups,
                       sort_tabs }) =>
  async.all([init_tabs], ({ windows, events }) => {

    const sort = (x, y) =>
      sort_groups(record.get(x, "info"), record.get(y, "info"));

    const make = () => {
      const groups = stream.make_sorted_list(sort);
      const group_ids = record.make();
      const tab_ids = record.make();


      const get_group = (tab) => {
        const { id, data } = get_group_data(tab);

        if (record.has(group_ids, id)) {
          return record.get(group_ids, id);

        } else {
          // TODO update the name periodically
          const group = make_group(id,
                                   get_group_name(data),
                                   stream.make_sorted_list(sort_tabs),
                                   data);

          record.insert(group_ids, id, group);
          stream.sorted_insert(groups, group);
          update_groups(groups);

          return group;
        }
      };

      const remove_tab = (group, x) => {
        const tabs = record.get(group, "tabs");

        stream.sorted_remove(tabs, x);

        // TODO what if `tabs.size` is 0 ?
        update_tabs(group);

        // TODO is this correct ?
        if (list.size(stream.current(tabs)) === 0) {
          record.remove(group_ids, record.get(group, "id"));
          stream.sorted_remove(groups, group);
          update_groups(groups);
        }
      };

      const update_tab = (x, tab, f) => {
        const old_group = record.get(x, "group");
        const new_group = get_group(tab);

        if (old_group === new_group) {
          f();

          // TODO test this
          stream.sorted_update(record.get(old_group, "tabs"), x);

        } else {
          record.update(x, "group", new_group);

          remove_tab(old_group, x);

          f();

          stream.sorted_insert(record.get(new_group, "tabs"), x);

          update_tabs(new_group);
        }
      };

      const new_tab = (tab) => {
        const id    = record.get(tab, "id");
        const group = get_group(tab);
        const tabs  = record.get(group, "tabs");
        const x     = make_tab(group, tab);

        record.insert(tab_ids, id, x);
        stream.sorted_insert(tabs, x);
        update_tabs(group);

        return x;
      };


      const types = record.make({
        "tab-open": ({ tab }) => {
          new_tab(tab);

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        "tab-focus": ({ tab }) => {
          const x = record.get(tab_ids, record.get(tab, "id"));

          // TODO this is only needed for "focused"
          // TODO a little bit hacky
          // TODO update the timestamp for the tab ?
          // TODO update "focused" for the tab ?
          update_tab(x, tab, functions.noop);

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        // TODO code duplication
        "tab-update": ({ tab }) => {
          const x = record.get(tab_ids, record.get(tab, "id"));

          // TODO this is only needed for "title" and "url"
          // TODO a little bit hacky
          update_tab(x, tab, () => {
            // TODO remove + insert the tab if the URL is different ?
            ref.set(record.get(x, "url"), record.get(tab, "url"));
            ref.set(record.get(x, "title"), record.get(tab, "title"));
            ref.set(record.get(x, "favicon"), record.get(tab, "favicon"));
          });

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        "tab-close": ({ tab }) => {
          const id = record.get(tab, "id");
          const x = record.get(tab_ids, id);
          const group = record.get(x, "group");

          record.update(x, "group", null);
          record.remove(tab_ids, id);

          remove_tab(group, x);

          // TODO is this needed ?
          // TODO can this be made more efficient ?
          search(groups);
        },


        // TODO test these
        "tab-unfocus": functions.noop,
        "tab-move": functions.noop,
        "window-open": functions.noop,
        "window-close": functions.noop,
        "tag-create": functions.noop,
        "tag-insert-tab": functions.noop,
        "tag-remove-tab": functions.noop,
        "tag-remove": functions.noop
      });


      const stop1 = event.on_receive(events, (x) => {
        record.get(types, x.type)(x);
      });

      // TODO test this
      const stop2 = ref.on_change(value, () => {
        search(groups);
      });


      list.each(windows, (window) => {
        list.each(record.get(window, "tabs"), (tab) => {
          new_tab(tab);
        });
      });

      search(groups);


      // TODO test this
      const stop = () => {
        running.stop(stop1);
        running.stop(stop2);
      };

      return { groups, stop };
    };


    return async.done({ make });
  });
