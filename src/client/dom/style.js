import { each, entries, join } from "../../util/iterator";
import { assert } from "../../util/assert";
import { batch_write } from "./batch";


const add_rules = (() => {
  const prefixes = {
    // TODO it's a bit hacky to use the prefix system for this purpose...
    //"width": ["width", "min-width", "max-width"],
    //"height": ["height", "min-height", "max-height"],
    "box-sizing": ["-moz-box-sizing", "box-sizing"] // TODO get rid of this later
  };

  return (style, rules) => {
    each(entries(rules), ([key, value]) => {
      const keys = (prefixes[key]
                     ? prefixes[key]
                     : [key]);

      const old_values = keys["map"]((key) => style["getPropertyValue"](key));

      const new_values = keys["map"]((key) => {
        // The third argument must be ""
        // http://dev.w3.org/csswg/cssom/#dom-cssstyledeclaration-setpropertyproperty-value-priority
        style["setProperty"](key, value, "");

        return style["getPropertyValue"](key);
      });

      const every = new_values["every"]((new_value, i) => {
        const old_value = old_values[i];
        // TODO  && old_value !== value
        return new_value === old_value;
      });

      if (every) {
        throw new Error("Invalid key or value (\"" + key + "\": \"" + value + "\")");
      }
    });
  };
})();


class Style {
  constructor(name, rules) {
    this._name = name;
    this._rules = rules;
  }
}

export const make_style = (() => {
  let style_id = 0;

  // TODO use batch_write ?
  var e = document["createElement"]("style");
  e["type"] = "text/css";
  document["head"]["appendChild"](e);

  const sheet = e["sheet"];
  const cssRules = sheet["cssRules"];

  return (rules) => {
    const class_name = "__style_" + (++style_id) + "__";

    batch_write(() => {
      // TODO this may not work in all browsers
      const index = sheet["insertRule"]("." + class_name + "{}", cssRules["length"]); // TODO sheet.addRule(s)

      const style = cssRules[index]["style"];

      add_rules(style, rules);
    });

    return new Style(class_name, rules);
  };
})();


class Animation {
  constructor(css, duration) {
    this._css = css;
    this._duration = duration;
  }
}

const mangle_property = (key) =>
  key["replace"](/([a-z])\-([a-z])/g, (_, x1, x2) => x1 + x2["toUpperCase"]());

// TODO verify that the CSS properties exist ?
export const make_animation = (() => {
  //const tester = document["createElement"]("div");

  return (o) => {
    const css = {};

    const props = [];

    each(entries(o.style), ([key, value]) => {
      const mangled = mangle_property(key);
      css[mangled] = value;
      props["push"](mangled);
    });

    css["clearProps"] = join(props, ",");

    return new Animation(css, o.duration / 1000);
  };
})();
