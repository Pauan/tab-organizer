import { SortedList } from "../../../util/mutable/list";
import { Record } from "../../../util/mutable/record";
import { Ref } from "../../../util/mutable/ref";
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

const diff_to_text = (diff) => {
  if (diff.day === 0) {
    if (diff.hour === 0) {
      return "Less than an hour ago";
    } else {
      return pluralize(diff.hour, " hour") + " ago";
    }
  } else {
    // TODO is this correct ?
    const hours = diff.hour - (diff.day * 24);
    return pluralize(diff.day, " day") + " " + pluralize(hours, " hour") + " ago";
  }
};

const get_group_name = (time) =>
  diff_to_text(difference(round_to_hour(current_time()), time));


export const make = () => {
  const group_ids = new Record();

  const groups = new SortedList(sort_group);

  const get_groups = (tab) => {
    const time = round_to_hour(tab.get("time").get("created"));
    const id = "" + time;

    if (group_ids.has(id)) {
      return [group_ids.get(id)];

    } else {
      // TODO code duplication
      const group = new Record({
        "id": id,
        "name": new Ref(get_group_name(time)),
        "time": time,
        "tabs": new SortedList(sort_tab),

        // TODO a little hacky
        "first-selected-tab": null,

        "matches": new Ref(false),
        "height": new Ref(null)
      });

      group_ids.insert(id, group);

      group_list.insert(group);

      return [group];
    }
  };

  return {};
};
