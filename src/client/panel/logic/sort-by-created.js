import { SortedList } from "../../../util/mutable/list";
import { Set } from "../../../util/mutable/set";
import { Record } from "../../../util/mutable/record";
import { Ref } from "../../../util/mutable/ref";
import { each } from "../../../util/iterator";
import { search, on_change } from "../search/search";
import { difference, round_to_hour, current_time } from "../../../util/time";


const sort_group = (x, y) =>
  y.get("time") - x.get("time");

const sort_tab = (x, y) =>
  y.get("time").get("created") -
  x.get("time").get("created");

// TODO move this to another module
const pluralize = (x, s) => {
  if (x === 1) {
    return x + s;
  } else {
    return x + s + "s";
  }
};

// TODO test this
const diff_to_text = ({ year, week, day, hour }) => {
  if (year === 0 && week === 0 && day === 0 && hour === 0) {
    return "Less than an hour ago";

  } else {
    const out = [];

    if (year > 0) {
      out["push"](pluralize(year, " year"));
    }

    if (week > 0) {
      out["push"](pluralize(week, " week"));
    }

    if (day > 0) {
      out["push"](pluralize(day, " day"));
    }

    if (hour > 0) {
      out["push"](pluralize(hour, " hour"));
    }

    return out["join"](" ") + " ago";
  }
};

const get_group_name = (time) =>
  diff_to_text(difference(round_to_hour(current_time()), time));


export const make = () => {
  const group_ids = new Record();

  const groups = new SortedList(sort_group);

  const get_group = (tab) => {
    const time = round_to_hour(tab.get("time").get("created"));
    const id = "" + time;

    if (group_ids.has(id)) {
      return group_ids.get(id);

    } else {
      // TODO code duplication
      const group = new Record({
        "id": id,
        // TODO update the name periodically
        "name": new Ref(get_group_name(time)),
        "time": time,
        "tabs": new SortedList(sort_tab),

        // TODO code duplication
        // TODO a little hacky
        "first-selected-tab": null,

        "matches": new Ref(false),
        "height": new Ref(null)
      });

      group_ids.insert(id, group);

      groups.insert(group);

      return group;
    }
  };

  // TODO handle stop
  on_change(() => {
    search(groups);
  });

  const init = (windows) => {
    each(windows, (window) => {
      each(window.get("tabs"), (tab) => {
        get_group(tab).get("tabs").insert(tab);
      });
    });

    /*setTimeout(() => {
      each(groups, (group) => {
        groups.remove(group);
      });
    }, 5000);*/

    search(groups);
  };

  const tab_open = (tab) => {
    get_group(tab).get("tabs").insert(tab);

    // TODO can this be made more efficient ?
    search(groups);
  };

  const tab_focus = () => {};

  const tab_unfocus = () => {};

  const tab_update = () => {
    // TODO can this be made more efficient ?
    search(groups);
  };

  // TODO does this need to call `search` ?
  const tab_move = () => {};

  const tab_close = (tab) => {
    // TODO is this necessary ?
    const removed = new Set();

    // TODO this can be made more efficient
    each(groups, (group) => {
      const tabs = group.get("tabs");

      if (tabs.has(tab)) {
        tabs.remove(tab);

        if (tabs.size === 0) {
          removed.insert(group);
        }
      }
    });

    each(removed, (group) => {
      group_ids.remove(group.get("id"));
      groups.remove(group);
    });

    // TODO is this necessary ?
    search(groups);
  };

  const window_open = () => {};

  const window_close = () => {};

  return { groups, init, tab_open, tab_focus, tab_unfocus, tab_update,
           tab_move, tab_close, window_open, window_close };
};
