import * as record from "../../util/record";
import * as list from "../../util/list";
import * as ref from "../../util/ref";
import { assert, fail } from "../../util/assert";


export const has_style = (style, key) =>
  record.has(style, key);

export const get_style_value = (style, key) => {
  const value = record.get(style, key);

  // TODO this may break on earlier versions of Chrome
  assert(style["getPropertyValue"](key) === value);
  assert(value != null);

  if (value === "") {
    return null;
  } else {
    return value;
  }
};

const stringify = (x) => {
  if (x === null) {
    return "" + x;
  } else {
    return "\"" + x + "\"";
  }
};

export const set_style_value = (() => {
  const prefixes = {
    // TODO it's a bit hacky to use the prefix system for this purpose...
    //"width": ["width", "min-width", "max-width"],
    //"height": ["height", "min-height", "max-height"],
    "box-sizing": ["-moz-box-sizing", "box-sizing"], // TODO get rid of this later
    "filter": ["-webkit-filter"] // TODO add in "filter" later
  };

  return (style, key, value, important = false) => {
    // TODO test this
    if (typeof key !== "string") {
      fail(new Error("Key must be a string: " + key));
    }

    // TODO test this
    if (value !== null && typeof value !== "string") {
      fail(new Error("Value must be null or a string: " + value));
    }

    if (value === "") {
      fail(new Error("Value cannot be \"\", use `null` instead"));
    }

    const keys = (prefixes[key]
                   ? prefixes[key]
                   : [key]);

    let seen = false;

    list.each(keys, (key) => {
      if (has_style(style, key)) {
        seen = true;

        const old_value = get_style_value(style, key);

        if (old_value !== value) {
          // TODO test this
          if (value === null) {
            style["removeProperty"](key);

          } else {
            // TODO does this trigger a relayout ?
            // https://drafts.csswg.org/cssom/#dom-cssstyledeclaration-setproperty
            style["setProperty"](key, value, (important ? "important" : ""));
          }


          const new_value = get_style_value(style, key);

          if (old_value === new_value) {
            fail(new Error("Invalid value (\"" + key + "\": " + stringify(value) + ")"));
          }
        }
      }
    });

    if (!seen) {
      fail(new Error("Invalid keys (\"" + list.join(keys, "\", \"") + "\")"));
    }
  };
})();


const e = document["createElement"]("style");
e["type"] = "text/css";
// TODO does this trigger a relayout ?
document["head"]["appendChild"](e);

const sheet = e["sheet"];
const cssRules = sheet["cssRules"];

export const insert_rule = (rule) => {
  // TODO does this trigger a relayout ?
  // TODO this may not work in all browsers
  // TODO sheet.addRule(s)
  const index = sheet["insertRule"](rule + " {}", cssRules["length"]);

  return cssRules[index];
};


let style_id = 0;

export const make_style = (rules) => {
  const class_name = "__style_" + (++style_id) + "__";

  make_stylesheet("." + class_name, rules);

  return {
    _type: 0,
    _name: class_name
  };
};


export const set_rules = (style, rules) => {
  record.each(rules, (key, value) => {
    ref.listen(value, (value) => {
      set_style_value(style, key, value);
    });
  });
};

export const make_stylesheet = (name, rules) => {
  const style = insert_rule(name)["style"];

  set_rules(style, rules);
};
