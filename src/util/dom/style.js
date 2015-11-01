import * as record from "../record";
import * as list from "../list";
import * as ref from "../ref";
import { assert, crash } from "../assert";


const key_prefixes = {
  // TODO it's a bit hacky to use the prefix system for this purpose...
  //"width": ["width", "min-width", "max-width"],
  //"height": ["height", "min-height", "max-height"],
  "box-sizing": ["-moz-box-sizing", "box-sizing"], // TODO get rid of this later
  "filter": ["-webkit-filter"] // TODO add in "filter" later
};

const value_prefixes = {
  "grab": ["-webkit-grab", "grab"],
  "grabbing": ["-webkit-grabbing", "grabbing"]
};

const prefix_key = (x) => {
  if (key_prefixes[x]) {
    return key_prefixes[x];
  } else {
    return [x];
  }
};

const prefix_value = (x) => {
  if (x === null) {
    return [x];
  } else if (value_prefixes[x]) {
    return value_prefixes[x];
  } else {
    return [x];
  }
};


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


const check_style_key = (key) => {
  // TODO test this
  if (typeof key !== "string") {
    crash(new Error("Key must be a string: " + key));
  }
};

const check_style_value = (value) => {
  // TODO test this
  if (value !== null && typeof value !== "string") {
    crash(new Error("Value must be null or a string: " + value));
  }

  if (value === "") {
    crash(new Error("Value cannot be \"\", use `null` instead"));
  }
};


export const set_style_value = (style, key, value) => {
  check_style_key(key);
  check_style_value(value);

  const keys   = prefix_key(key);
  const values = prefix_value(value);

  let seen = false;

  list.each(keys, (key) => {
    if (has_style(style, key)) {
      seen = true;

      const old_value = get_style_value(style, key);

      list.each(values, (value) => {
        if (old_value !== value) {
          // TODO test this
          if (value === null) {
            style["removeProperty"](key);

          } else {
            // TODO does this trigger a relayout ?
            // https://drafts.csswg.org/cssom/#dom-cssstyledeclaration-setproperty
            style["setProperty"](key, value, "");
          }


          const new_value = get_style_value(style, key);

          if (old_value === new_value) {
            crash(new Error("Invalid value (\"" + key + "\": " + stringify(value) + ")"));
          }
        }
      });
    }
  });

  if (!seen) {
    crash(new Error("Invalid keys (\"" + list.join(keys, "\", \"") + "\")"));
  }
};


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
