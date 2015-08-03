import { each } from "../../../util/iterator";
import { Event } from "../../../util/event";


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
// http://www.regular-expressions.info/characters.html
const escape_regexp = (s) =>
  s["replace"](/[\\\^\$\*\+\?\.\|\(\)\{\}\[\]]/g, "\\$&");

const parse_search = (value) => {
  const re = new RegExp(escape_regexp(value), "i");

  return (tab) => {
    return re["test"](tab.get("title").get()) ||
           re["test"](tab.get("url").get());
  };
};


let search_value = "";
let search_parsed = parse_search(search_value);

const _on_change = Event();
export const on_change = _on_change.receive;

export const search = (a) => {
  each(a, (group) => {
    let seen = false;

    each(group.get("tabs"), (tab) => {
      if (search_parsed(tab)) {
        tab.get("matches").set(true);
        seen = true;

      } else {
        tab.get("matches").set(false);
      }
    });

    group.get("matches").set(seen);
  });
};

export const change_search = (value) => {
  if (search_value !== value) {
    search_value = value;
    search_parsed = parse_search(search_value);
    _on_change.send(undefined);
  }
};
