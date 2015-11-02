import * as record from "../../../../util/record";
import { make } from "../sorted";
import { get_group_name, get_group_time } from "../time";


const get_time = (tab) => {
  const time = record.get(tab, "time");

  return record.get_default(time, "focused", () =>
           record.get(time, "created"));
};


// TODO code duplication
export const init = make({
  get_group_data: (tab) => {
    const data = get_group_time(get_time(tab));
    const id   = "" + data;

    return { data, id };
  },

  get_group_name: get_group_name,

  // TODO replace with numeric sort function
  sort_groups: (x, y) =>
    y - x,

  // TODO replace with numeric sort function
  sort_tabs: (x, y) =>
    get_time(y) - get_time(x)
});
