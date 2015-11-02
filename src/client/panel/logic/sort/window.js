import * as list from "../../../../util/list";
import * as stream from "../../../../util/stream";
import * as record from "../../../../util/record";
import * as functions from "../../../../util/functions";
import * as running from "../../../../util/running";
import * as async from "../../../../util/async";
import * as ref from "../../../../util/ref";
import * as event from "../../../../util/event";
import { init as init_tabs } from "../../../sync/tabs";
import { assert } from "../../../../util/assert";
import { search, value } from "../../search/search";
import { make_group, make_tab, make_group_tab,
         update_group, update_tabs } from "../general";


// TODO this can be more efficient if it's given a starting index
const update_group_names = (groups) => {
  list.each(stream.current(groups), (group, i) => {
    update_group(group, i);

    if (record.get(group, "info") === null) {
      ref.set(record.get(group, "name"), "" + (i + 1));
    }
  });
};


export const init = async.all([init_tabs], (sync) => {

  const make = () => {
    const groups = stream.make_list();
    const group_ids = record.make();
    const tab_ids = record.make();


    const new_group = (window) => {
      const tabs = stream.make_list();

      const group = make_group(record.get(window, "id"),
                               ref.make(record.get(window, "name")),
                               tabs,
                               record.get(window, "name"));

      list.each(record.get(window, "tabs"), (tab_id) => {
        const tab = record.get(sync.tab_ids, tab_id);

        const transient = record.get_default(sync.transient_ids, tab_id, () =>
                            null);

        const x = make_tab(tab, transient);

        record.insert(tab_ids, record.get(x, "id"), x);

        stream.push(tabs, make_group_tab(group, x));
      });

      update_tabs(group);

      record.insert(group_ids, record.get(group, "id"), group);

      return group;
    };


    const types = record.make({
      "tab-open": (json) => {
        const tab       = record.get(json, "tab");
        const window_id = record.get(json, "window-id");
        const index     = record.get(json, "tab-index");
        const transient = record.get(json, "tab-transient");

        const group = record.get(group_ids, window_id);

        const x = make_tab(tab, transient);

        record.insert(tab_ids, record.get(x, "id"), x);

        stream.insert(record.get(group, "tabs"), index,
          make_group_tab(group, x));

        update_tabs(group);

        search(groups);
      },


      "tab-focus": (json) => {
        const tab_id = record.get(json, "tab-id");

        const x = record.get(tab_ids, tab_id);

        ref.set(record.get(x, "focused"), true);
      },


      "tab-unfocus": (json) => {
        const tab_id = record.get(json, "tab-id");

        const x = record.get(tab_ids, tab_id);

        ref.set(record.get(x, "focused"), false);
      },


      "tab-update": (json) => {
        const tab_id  = record.get(json, "tab-id");
        const url     = record.get(json, "tab-url");
        const title   = record.get(json, "tab-title");
        const favicon = record.get(json, "tab-favicon");
        const pinned  = record.get(json, "tab-pinned");

        const x = record.get(tab_ids, tab_id);

        ref.set(record.get(x, "url"), url);
        ref.set(record.get(x, "title"), title);
        ref.set(record.get(x, "favicon"), favicon);
        ref.set(record.get(x, "pinned"), pinned);

        search(groups);
      },


      "tab-move": (json) => {
        const old_window_id = record.get(json, "window-old-id");
        const new_window_id = record.get(json, "window-new-id");
        const old_index     = record.get(json, "tab-old-index");
        const new_index     = record.get(json, "tab-new-index");
        const tab_id        = record.get(json, "tab-id");

        const old_group = record.get(group_ids, old_window_id);
        const new_group = record.get(group_ids, new_window_id);
        const old_tabs  = record.get(old_group, "tabs");
        const new_tabs  = record.get(new_group, "tabs");
        const x         = record.get(tab_ids, tab_id);

        stream.remove(old_tabs, old_index);
        // TODO what if the tab was selected, shouldn't it stay selected ?
        stream.insert(new_tabs, new_index, make_group_tab(new_group, x));

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


      "tab-close": (json) => {
        const window_id = record.get(json, "window-id");
        const tab_id    = record.get(json, "tab-id");
        const index     = record.get(json, "tab-index");

        const group = record.get(group_ids, window_id);
        const tabs  = record.get(group, "tabs");

        record.remove(tab_ids, tab_id);

        stream.remove(tabs, index);


        // This is needed in order for animations to
        // properly play when removing a group
        // TODO test this
        // TODO test if this is needed or not
        if (list.size(stream.current(tabs)) === 0) {
          record.remove(group_ids, window_id);

          const group_index = record.get(group, "index");

          assert(list.index_of(stream.current(groups), group) === group_index);

          stream.remove(groups, group_index);

          update_group_names(groups);


        } else {
          update_tabs(group);
        }


        // TODO is this needed ?
        search(groups);
      },


      "window-open": (json) => {
        const window = record.get(json, "window");
        const index  = record.get(json, "window-index");

        const group = new_group(window);

        stream.insert(groups, index, group);
        update_group_names(groups);

        search(groups);
      },


      "window-close": (json) => {
        const window_id = record.get(json, "window-id");
        const index     = record.get(json, "window-index");

        // TODO test this
        if (record.has(group_ids, window_id)) {
          const group = record.get(group_ids, window_id);

          record.remove(group_ids, window_id);

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


    const stop1 = event.on_receive(sync.events, (x) => {
      record.get(types, record.get(x, "type"))(x);
    });

    // TODO test this
    // TODO move this into logic.js
    const stop2 = ref.on_change(value, () => {
      search(groups);
    });


    list.each(sync.windows, (window_id) => {
      const window = record.get(sync.window_ids, window_id);
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
