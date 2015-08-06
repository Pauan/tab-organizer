import { make } from "./sorted";
import { lowercase } from "../../../util/string";
import { simplify, parse } from "../../../util/url";


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

const get_url = (tab) =>
  // TODO is this correct? maybe it shouldn't lowercase ?
  // TODO this should probably sort based upon the minified URL
  lowercase(tab.get("url").get());

// TODO code duplication
const get_time = (tab) =>
  tab.get("time").get("created");

const get_name = (parsed) => {
  if (parsed !== null) {
    if (parsed.protocol === "chrome:") {
      return "chrome://";

    } else {
      return parsed.protocol + parsed.separator + parsed.authority + parsed.domain + parsed.port;
    }

  } else {
    return "";
  }
};

export const init = make({
  get_group_data: (tab) => {
    const url = tab.get("url");

    const parsed = (url !== null
                       // TODO this should use the same function that "url-bar.js" uses, but it's faster to use `simplify`
                     ? simplify(parse(url))
                     : null);

    const name = get_name(parsed);

    return {
      data: name,
      id: name
    };
  },

  // TODO code duplication
  get_group_name: (data) => data,

  sort_groups: (x, y) =>
    (x === "chrome://"
      ? -1
      : (y === "chrome://"
          ? 1
          : sort(x, y))),

  sort_tabs: (x, y) =>
    // TODO test this
    sort(get_url(x), get_url(y)) || get_time(x) - get_time(y)
});
