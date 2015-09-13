import * as record from "../../../util/record";
import * as ref from "../../../util/ref";
import * as functions from "../../../util/functions";
import { make } from "../logic/sorted";
import { uppercase, sort } from "../../../util/string";


const get_title = (tab) => {
  const title = ref.get(record.get(tab, "title"));

  if (title === null) {
    return "";

  } else {
    return uppercase(title);
  }
};

const get_time = (tab) =>
  record.get(record.get(tab, "time"), "created");

export const init = make({
  get_group_data: (tab) => {
    const title = record.get(tab, "title");

    const first = (title === null
                    ? ""
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
    get_time(x) - get_time(y)
});
