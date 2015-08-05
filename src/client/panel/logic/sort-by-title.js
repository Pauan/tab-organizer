import { make } from "./sorted";


// TODO code duplication
// TODO move this into another module
const sort = (x, y) => {
  if (x === y) {
    return 0;
  } else if (x < y) {
    return -1;
  } else {
    return 1;
  }
};

// TODO move into another module
const uppercase = (s) =>
  s["toLocaleUpperCase"]();

// TODO move into another module
const lowercase = (s) =>
  s["toLocaleLowerCase"]();

const get_title = (tab) =>
  lowercase(tab.get("title").get());

const get_time = (tab) =>
  tab.get("time").get("created");

export const init = make({
  get_group_data: (tab) => {
    const title = tab.get("title");

    const first = (title === ""
                    ? title
                    : uppercase(title[0]));

    return {
      data: first,
      id: first
    };
  },

  get_group_name: (data) => data,

  sort_groups: sort,

  sort_tabs: (x, y) =>
    // TODO test this
    sort(get_title(x), get_title(y)) || get_time(x) - get_time(y)
});
