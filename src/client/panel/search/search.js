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

// TODO is this the right place to put this ?
export const visible = new Ref({ groups: 0, tabs: 0 });


let search_parsed = null;

value.each((value) => {
  localStorage["search.last"] = value;
  search_parsed = parse_search(value);
});


export const search = (a) => {
  let groups = 0;
  let tabs   = 0;

  each(a, (group) => {
    let seen = false;

    each(group.get("tabs"), (tab) => {
      if (search_parsed(tab)) {
        tab.get("visible").set(true);
        seen = true;
        ++tabs;

      } else {
        tab.get("visible").set(false);
      }
    });

    if (seen) {
      ++groups;
    }

    group.get("visible").set(seen);
  });

  visible.set({ groups, tabs });
};

export const matches = (tab) =>
  search_parsed(tab);
