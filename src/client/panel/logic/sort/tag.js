import * as list from "../../../../util/list";
import * as stream from "../../../../util/stream";
import * as record from "../../../../util/record";
import * as functions from "../../../../util/functions";
import * as running from "../../../../util/running";
import * as async from "../../../../util/async";
import * as ref from "../../../../util/ref";
import * as event from "../../../../util/event";
import * as string from "../../../../util/string";
import { init as init_tabs } from "../../../sync/tabs";
import { assert } from "../../../../util/assert";
import { search, value } from "../../search/search";
import { make_group, make_tab, make_group_tab,
         update_groups, update_tabs } from "../general";


export const init = async.all([init_tabs], (sync) => {

  const make = () => {
    const groups = stream.make_sorted_list(string.sort);
    const group_ids = record.make();
    const tab_ids = record.make();


    // TODO code duplication with window.js
    const new_group = (tag) => {
      const tabs = stream.make_list();

      const group = make_group(record.get(tag, "id"),
                               ref.make(record.get(tag, "id")),
                               tabs,
                               null);

      list.each(record.get(tag, "tabs"), (tab_id) => {
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
        const transient = record.get(json, "tab-transient");

        // TODO assert that it doesn't have any tags ?
        const x = make_tab(tab, transient);

        record.insert(tab_ids, record.get(x, "id"), x);
      },


      // TODO code duplication with window.js
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


      "tab-close": (json) => {
        const tab_id = record.get(json, "tab-id");

        // TODO assert that it doesn't have any tags ?
        record.remove(tab_ids, tab_id);
      },


      "tag-create": (json) => {
        const tag = record.get(json, "tag");

        assert(list.size(record.get(tag, "tabs")) === 0);

        const group = new_group(tag);

        stream.sorted_insert(groups, group);

        update_groups(groups);
      },


      "tag-insert-tab": (json) => {
        const tag_id = record.get(json, "tag-id");
        const tab_id = record.get(json, "tab-id");

        const group = record.get(group_ids, tag_id);
        const tab   = record.get(tab_ids, tab_id);
        const tabs  = record.get(group, "tabs");

        stream.push(tabs, make_group_tab(group, tab));

        update_tabs(group);

        search(groups);
      },


      // TODO some code duplication with window.js
      "tag-remove-tab": (json) => {
        const tag_id = record.get(json, "tag-id");
        const index  = record.get(json, "tab-index");

        const group = record.get(group_ids, tag_id);
        const tabs  = record.get(group, "tabs");


        // TODO assert that the index is correct
        stream.remove(tabs, index);


        // This is needed in order for animations to
        // properly play when removing a group
        // TODO test this
        // TODO test if this is needed or not
        if (list.size(stream.current(tabs)) === 0) {
          record.remove(group_ids, tag_id);

          stream.sorted_remove(groups, group);

          update_groups(groups);

        } else {
          update_tabs(group);
        }


        // TODO is this needed ?
        search(groups);
      },


      "tag-remove": (json) => {
        const tag_id = record.get(json, "tag-id");

        // TODO test this
        if (record.has(group_ids, tag_id)) {
          const group = record.get(group_ids, tag_id);

          record.remove(group_ids, tag_id);

          stream.sorted_remove(groups, group);

          update_groups(groups);
        }
      },


      // TODO test these
      "tab-focus": functions.noop,
      "tab-unfocus": functions.noop,
      "tab-move": functions.noop,
      "window-open": functions.noop,
      "window-close": functions.noop
    });


    const stop1 = event.on_receive(sync.events, (x) => {
      record.get(types, record.get(x, "type"))(x);
    });

    // TODO test this
    // TODO move this into logic.js
    const stop2 = ref.on_change(value, () => {
      search(groups);
    });


    record.each(sync.tag_ids, (tag_id, tag) => {
      const group = new_group(tag);
      stream.sorted_insert(groups, group);
    });

    update_groups(groups);
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
