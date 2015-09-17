import * as record from "../../../util/record";
import * as functions from "../../../util/functions";
import { make } from "../logic/sorted";
import { get_title, get_created } from "../logic/general";
import { uppercase, sort } from "../../../util/string";


export const init = make({
  get_group_data: (tab) => {
    const title = record.get(tab, "title");

    const first = (title === null
                    ? ""
                    // TODO use locale-aware function for this ?
                    : uppercase(title[0]));

    return {
      data: first,
      id: first
    };
  },

  get_group_name: functions.self,

  sort_groups: sort,

  sort_tabs: (x, y) =>
    // TODO test this
    sort(get_title(x), get_title(y)) ||
    // TODO use numeric sort function
    get_created(x) - get_created(y)
});
