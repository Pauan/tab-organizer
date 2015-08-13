import { each, entries } from "../../util/iterator";


export const set_style = (() => {
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
      throw new Error("Key must be a string: " + key);
    }

    // TODO test this
    if (value !== null && typeof value !== "string") {
      throw new Error("Value must be null or a string: " + value);
    }

    if (value === "") {
      throw new Error("Value cannot be \"\", use `null` instead");
    }

    const keys = (prefixes[key]
                   ? prefixes[key]
                   : [key]);

    const old_values = keys["map"]((key) => style["getPropertyValue"](key));

    const new_values = keys["map"]((key) => {
      // TODO test this
      if (value === null) {
        style["removeProperty"](key);

      } else {
        // https://drafts.csswg.org/cssom/#dom-cssstyledeclaration-setproperty
        style["setProperty"](key, value, (important ? "important" : ""));
      }

      return style["getPropertyValue"](key);
    });

    const every = new_values["every"]((new_value, i) => {
      const old_value = old_values[i];
      // TODO is this correct ?
      return (new_value === old_value) &&
             (old_value !== value);
    });

    if (every) {
      throw new Error("Invalid key or value (\"" + key + "\": \"" + value + "\")");
    }
  };
})();


class Style {
  constructor(name, style, rules) {
    this._name = name;
    this._rules = rules;
    this._style = style;
    // TODO a little hacky
    this._keys = Object["keys"](rules);
  }
}

class Animation {
  constructor(name) {
    this._name = name;
    this._duration = "0ms";
    this._easing = "linear";
  }
}


let style_id = 0;

// TODO use batch_write ?
const e = document["createElement"]("style");
e["type"] = "text/css";
document["head"]["appendChild"](e);

const sheet = e["sheet"];
const cssRules = sheet["cssRules"];


export const make_style = (rules) => {
  const class_name = "__style_" + (++style_id) + "__";

  // TODO this may not work in all browsers
  const index = sheet["insertRule"]("." + class_name + " {}",
                                    cssRules["length"]); // TODO sheet.addRule(s)

  const style = cssRules[index]["style"];

  each(entries(rules), ([key, value]) => {
    value.each((value) => {
      set_style(style, key, value);
    });
  });

  return new Style(class_name, style, rules);
};


export const make_animation = ({ from, to, duration, easing }) => {
  const class_name = "__animation_" + (++style_id) + "__";

  const animation = new Animation(class_name);

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
    each(entries(from), ([key, value]) => {
      value.each((value) => {
        // TODO does this throw an error on un-animatable values ?
        set_style(from_style, key, value);
      });
    });
  }

  // TODO is this less efficient than specifying the values ?
  if (to) {
    each(entries(to), ([key, value]) => {
      value.each((value) => {
        // TODO does this throw an error on un-animatable values ?
        set_style(to_style, key, value);
      });
    });
  }

  if (easing) {
    easing.each((easing) => {
      animation._easing = easing;
    });
  }

  if (duration) {
    duration.each((duration) => {
      animation._duration = duration;
    });
  }

  return animation;
};
