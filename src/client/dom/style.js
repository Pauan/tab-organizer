import * as record from "../../util/record";
import * as list from "../../util/list";
import * as ref from "../../util/ref";
import { fail } from "../../util/assert";


export const get_style_value = (style, key) =>
  style["getPropertyValue"](key);

export const set_style_value = (() => {
  const prefixes = {
    // TODO it's a bit hacky to use the prefix system for this purpose...
    //"width": ["width", "min-width", "max-width"],
    //"height": ["height", "min-height", "max-height"],
    "box-sizing": ["-moz-box-sizing", "box-sizing"], // TODO get rid of this later
    "filter": ["-webkit-filter", "filter"]
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

    const old_values = list.map(keys, (key) => get_style_value(style, key));

    const new_values = list.map(keys, (key) => {
      // TODO test this
      if (value === null) {
        style["removeProperty"](key);

      } else {
        // TODO does this trigger a relayout ?
        // https://drafts.csswg.org/cssom/#dom-cssstyledeclaration-setproperty
        style["setProperty"](key, value, (important ? "important" : ""));
      }

      return get_style_value(style, key);
    });

    // TODO test this
    const every = list.all(new_values, (new_value, i) => {
      const old_value = list.get(old_values, i);
      // TODO is this correct ?
      return (new_value === old_value) &&
             (old_value !== value);
    });

    if (every) {
      fail(new Error("Invalid key or value (\"" + key + "\": \"" + value + "\")"));
    }
  };
})();


let style_id = 0;

const e = document["createElement"]("style");
e["type"] = "text/css";
// TODO does this trigger a relayout ?
document["head"]["appendChild"](e);

const sheet = e["sheet"];
const cssRules = sheet["cssRules"];


export const make_style = (rules) => {
  const class_name = "__style_" + (++style_id) + "__";

  make_stylesheet("." + class_name, rules);

  return {
    _type: 0,
    _name: class_name
  };
};


const set_rules = (style, rules) => {
  record.each(rules, (key, value) => {
    ref.listen(value, (value) => {
      set_style_value(style, key, value);
    });
  });
};

export const make_stylesheet = (name, rules) => {
  // TODO does this trigger a relayout ?
  // TODO this may not work in all browsers
  // TODO sheet.addRule(s)
  const index = sheet["insertRule"](name + " {}", cssRules["length"]);

  const style = cssRules[index]["style"];

  set_rules(style, rules);
};


export const make_animation = ({ from, to, duration, easing }) => {
  const class_name = "__animation_" + (++style_id) + "__";

  const animation = {
    _type: 1,
    _name: class_name,
    _duration: "0ms",
    _easing: "linear"
  };

  // TODO does this trigger a relayout ?
  // TODO this may not work in all browsers
  // TODO remove vendor prefix
  const index = sheet["insertRule"]("@-webkit-keyframes " + class_name + " {}",
                                    cssRules["length"]);

  const keyframe = cssRules[index];

  keyframe["appendRule"]("0% {}");
  keyframe["appendRule"]("100% {}");

  const from_style = keyframe["cssRules"][0]["style"];
  const to_style   = keyframe["cssRules"][1]["style"];

  // TODO is this less efficient than specifying the values ?
  if (from) {
    // TODO does this throw an error on un-animatable values ?
    set_rules(from_style, from);
  }

  // TODO is this less efficient than specifying the values ?
  if (to) {
    // TODO does this throw an error on un-animatable values ?
    set_rules(to_style, to);
  }

  if (easing) {
    ref.listen(easing, (easing) => {
      animation._easing = easing;
    });
  }

  if (duration) {
    ref.listen(duration, (duration) => {
      animation._duration = duration;
    });
  }

  return animation;
};
