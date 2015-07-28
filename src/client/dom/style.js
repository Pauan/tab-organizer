import { each, entries } from "../../util/iterator";


export const set_style = (() => {
  const prefixes = {
    // TODO it's a bit hacky to use the prefix system for this purpose...
    //"width": ["width", "min-width", "max-width"],
    //"height": ["height", "min-height", "max-height"],
    "box-sizing": ["-moz-box-sizing", "box-sizing"] // TODO get rid of this later
  };

  return (style, key, value) => {
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
        // The third argument must be ""
        // https://drafts.csswg.org/cssom/#dom-cssstyledeclaration-setproperty
        style["setProperty"](key, value, "");
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

    //batch_write(() => {
      // TODO this may not work in all browsers
      const index = sheet["insertRule"]("." + class_name + "{}", cssRules["length"]); // TODO sheet.addRule(s)

      const style = cssRules[index]["style"];

      each(entries(rules), ([key, value]) => {
        value.each((value) => {
          set_style(style, key, value);
        });
      });
    //});

    return new Style(class_name, style, rules);
  };
})();
