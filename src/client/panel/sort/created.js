import * as record from "../../../util/record";
import { make } from "../logic/sorted";
import { get_group_name, get_group_time } from "../logic/time";


const get_time = (tab) =>
  record.get(record.get(tab, "time"), "created");

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
