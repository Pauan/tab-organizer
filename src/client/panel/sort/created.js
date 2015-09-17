import { make } from "../logic/sorted";
import { get_created } from "../logic/general";
import { get_group_name, get_group_time } from "../logic/time";


export const init = make({
  get_group_data: (tab) => {
    const data = get_group_time(get_created(tab));
    const id   = "" + data;

    return { data, id };
  },

  get_group_name: get_group_name,

  // TODO replace with numeric sort function
  sort_groups: (x, y) =>
    y - x,

  // TODO replace with numeric sort function
  sort_tabs: (x, y) =>
    get_created(y) - get_created(x)
});
