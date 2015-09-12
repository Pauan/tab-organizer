import * as list from "../../../util/list";
import * as stream from "../../../util/stream";
import * as record from "../../../util/record";
import * as ref from "../../../util/ref";
import * as string from "../../../util/string";


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
// http://www.regular-expressions.info/characters.html
const escape_regexp = (s) =>
  string.replace(s, /[\\\^\$\*\+\?\.\|\(\)\{\}\[\]]/g, "\\$&");

const parse_search = (value) => {
  const re = new RegExp(escape_regexp(value), "i");

  return (tab) => {
    return string.test(ref.get(record.get(tab, "title")), re) ||
           string.test(ref.get(record.get(tab, "url")), re);
  };
};


export const value = ref.make(localStorage["search.last"] || "");

// TODO is this the right place to put this ?
export const visible = ref.make({ groups: 0, tabs: 0 });


let search_parsed = null;

ref.listen(value, (value) => {
  search_parsed = parse_search(value);
});

// TODO is this correct ?
ref.on_change(value, (value) => {
  localStorage["search.last"] = value;
});


export const search = (a) => {
  let groups = 0;
  let tabs   = 0;

  list.each(stream.current(a), (group) => {
    let seen = false;

    list.each(stream.current(record.get(group, "tabs")), (tab) => {
      const visible = record.get(tab, "visible");

      if (search_parsed(tab)) {
        ref.set(visible, true);
        seen = true;
        // TODO what if the same tab belongs to multiple groups ?
        ++tabs;

      } else {
        ref.set(visible, false);
      }
    });

    if (seen) {
      ++groups;
    }

    ref.set(record.get(group, "visible"), seen);
  });

  // TODO is this correct ?
  ref.modify(visible, (info) => {
    if (info.groups === groups &&
        info.tabs   === tabs) {
      return info;

    } else {
      return { groups, tabs };
    }
  });
};

export const matches = (tab) =>
  search_parsed(tab);
