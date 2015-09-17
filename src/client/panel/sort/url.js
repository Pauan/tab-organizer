import * as record from "../../../util/record";
import * as functions from "../../../util/functions";
import { make } from "../logic/sorted";
import { get_title, get_created } from "../logic/general";
import { sort } from "../../../util/string";
import { simplify, parse } from "../../../util/url";


const get_name = (parsed) => {
  if (parsed.protocol === "chrome:") {
    return "chrome://";

  } else {
    return parsed.protocol + parsed.separator + parsed.authority +
           parsed.domain + parsed.port;
  }
};

export const init = make({
  get_group_data: (tab) => {
    const url = record.get(tab, "url");

    const name = (url !== null
                   // TODO this should use the same function that "url-bar.js" uses, but it's faster to use `simplify`
                   ? get_name(simplify(parse(url)))
                   : "");

    return {
      data: name,
      id: name
    };
  },

  get_group_name: functions.self,

  sort_groups: (x, y) =>
    (x === "chrome://"
      ? -1
      : (y === "chrome://"
          ? 1
          : sort(x, y))),

  sort_tabs: (x, y) =>
    // TODO test this
    sort(get_title(x), get_title(y)) ||
    // TODO use numeric sort function
    get_created(x) - get_created(y)
});
