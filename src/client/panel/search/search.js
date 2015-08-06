import { each } from "../../../util/iterator";
import { Ref } from "../../../util/mutable/ref";


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


export const value = new Ref(localStorage["search.last"] || "");


let search_parsed = null;

value.each((value) => {
  localStorage["search.last"] = value;
  search_parsed = parse_search(value);
});


export const search = (a) => {
  each(a, (group) => {
    let seen = false;

    each(group.get("tabs"), (tab) => {
      if (search_parsed(tab)) {
        tab.get("visible").set(true);
        seen = true;

      } else {
        tab.get("visible").set(false);
      }
    });

    group.get("visible").set(seen);
  });
};

export const matches = (tab) =>
  search_parsed(tab);
