import * as list from "../../../util/list";
import * as stream from "../../../util/stream";
import * as record from "../../../util/record";
import * as functions from "../../../util/functions";
import * as running from "../../../util/running";
import * as async from "../../../util/async";
import * as ref from "../../../util/ref";
import * as event from "../../../util/event";
import { init as init_tabs } from "../../sync/tabs";
import { assert } from "../../../util/assert";
import { search, value } from "../search/search";
import { make_group, make_tab,
         update_groups, update_tabs } from "../logic/general";


// TODO this can be more efficient if it's given a starting index
// TODO inefficient; this should be combined with `update_groups` in some way
const update_group_names = (groups) => {
  update_groups(groups);

  list.each(stream.current(groups), (group, i) => {
    if (record.get(group, "info") === null) {
      ref.set(record.get(group, "header-name"), "" + (i + 1));
    }
  });
};


export const init = async.all([init_tabs], ({ windows, events }) => {

  const make = () => {
    const groups = stream.make_list();
    const group_ids = record.make();
    const tab_ids = record.make();


    const new_group = (window) => {
      const group = make_group(record.get(window, "id"),
                               record.get(window, "name"),
                               stream.make_list(),
                               record.get(window, "name"));

      const tabs = record.get(group, "tabs");

      list.each(record.get(window, "tabs"), (tab) => {
        const x = new_tab(group, tab);
        stream.push(tabs, x);
      });

      update_tabs(group);

      record.insert(group_ids, record.get(group, "id"), group);

      return group;
    };

    const new_tab = (group, tab) => {
      const id = record.get(tab, "id");
      const x = make_tab(group, tab);

      record.insert(tab_ids, id, x);

      return x;
    };


    const types = record.make({
      "tab-open": ({ tab, window, index }) => {
        const group = record.get(group_ids, record.get(window, "id"));

        const x = new_tab(group, tab);
        stream.insert(record.get(group, "tabs"), index, x);

        update_tabs(group);

        search(groups);
      },


      "tab-focus": ({ tab }) => {
        const x = record.get(tab_ids, record.get(tab, "id"));

        ref.set(record.get(x, "focused"), true);
      },


      "tab-unfocus": ({ tab }) => {
        const x = record.get(tab_ids, record.get(tab, "id"));

        ref.set(record.get(x, "focused"), false);
      },


      "tab-update": ({ tab }) => {
        const x = record.get(tab_ids, record.get(tab, "id"));

        ref.set(record.get(x, "url"), record.get(tab, "url"));
        ref.set(record.get(x, "title"), record.get(tab, "title"));
        ref.set(record.get(x, "favicon"), record.get(tab, "favicon"));

        search(groups);
      },


      "tab-move": ({ tab, old_window, new_window, old_index, new_index }) => {
        const old_group = record.get(group_ids, record.get(old_window, "id"));
        const new_group = record.get(group_ids, record.get(new_window, "id"));
        const old_tabs = record.get(old_group, "tabs");
        const new_tabs = record.get(new_group, "tabs");
        const x = record.get(tab_ids, record.get(tab, "id"));

        assert(list.get(stream.current(old_tabs), old_index) === x);

        stream.remove(old_tabs, old_index);
        stream.insert(new_tabs, new_index, x);

        // TODO test this
        if (old_group === new_group) {
          update_tabs(old_group);

        } else {
          update_tabs(old_group);
          update_tabs(new_group);
        }

        record.update(x, "group", new_group);

        // TODO is this needed ?
        search(groups);
      },


      "tab-close": ({ tab, window, index }) => {
        const id = record.get(tab, "id");
        const group = record.get(group_ids, record.get(window, "id"));
        const tabs = record.get(group, "tabs");
        const x = record.get(tab_ids, id);

        record.update(x, "group", null);
        record.remove(tab_ids, id);

        assert(list.get(stream.current(tabs), index) === x);
        stream.remove(tabs, index);

        // TODO what if `tabs.size` is 0 ?
        update_tabs(group);

        // This is needed in order for animations to
        // properly play when removing a group
        if (list.size(stream.current(tabs)) === 0) {
          record.remove(group_ids, record.get(group, "id"));

          assert(list.index_of(stream.current(groups), group) ===
                 record.get(group, "index"));

          stream.remove(groups, record.get(group, "index"));

          update_group_names(groups);
        }

        // TODO is this needed ?
        search(groups);
      },


      "window-open": ({ window, index }) => {
        const group = new_group(window);

        stream.insert(groups, index, group);
        update_group_names(groups);

        search(groups);
      },


      "window-close": ({ window, index }) => {
        const id = record.get(window, "id");

        if (record.has(group_ids, id)) {
          const group = record.get(group_ids, id);

          record.remove(group_ids, record.get(group, "id"));

          assert(list.get(stream.current(groups), index) === group);
          stream.remove(groups, index);

          update_group_names(groups);
        }
      },


      // TODO test these
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
      const group = new_group(window);
      stream.push(groups, group);
    });

    update_group_names(groups);
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
