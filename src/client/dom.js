import { each } from "../util/iterator";
import { Stream } from "../util/stream";
import { batch_read, batch_write } from "./dom/batch";
import { make_style, make_animation } from "./dom/style";
import { assert } from "../util/assert";
import { async, async_callback } from "../util/async";


class DOM {
  constructor(dom) {
    this._dom = dom;

    // TODO does this leak when the DOM element is removed ?
    // TODO test this
    this.on_hover = Stream((send, error, complete) => {
      const mouseover = () => {
        send(true);
      };

      const mouseout = () => {
        send(false);
      };

      this._dom["addEventListener"]("mouseover", mouseover, true);
      this._dom["addEventListener"]("mouseout", mouseout, true);

      // TODO test this
      return () => {
        this._dom["removeEventListener"]("mouseover", mouseover, true);
        this._dom["removeEventListener"]("mouseout", mouseout, true);
      };
    });

    // TODO does this leak when the DOM element is removed ?
    // TODO test this
    this.on_hold = Stream((send, error, complete) => {
      const mousedown = () => {
        send(true);
      };

      const mouseup = () => {
        send(false);
      };

      this._dom["addEventListener"]("mousedown", mousedown, true);
      addEventListener("mouseup", mouseup, true);

      // TODO test this
      return () => {
        this._dom["removeEventListener"]("mousedown", mousedown, true);
        removeEventListener("mouseup", mouseup, true);
      };
    });
  }

  add_style(style) {
    batch_write(() => {
      assert(!this._dom["classList"]["contains"](style._name));
      this._dom["classList"]["add"](style._name);
    });
  }

  remove_style(style) {
    batch_write(() => {
      assert(this._dom["classList"]["contains"](style._name));
      this._dom["classList"]["remove"](style._name);
    });
  }

  set_style(style, test) {
    if (test) {
      this.add_style(style);
    } else {
      this.remove_style(style);
    }
  }
}

class Text {
  constructor(s) {
    this._dom = document["createTextNode"](s);
  }
}

class Image extends DOM {
  set_url(s) {
    batch_write(() => {
      this._dom["src"] = s;
    });
  }
}

class Parent extends DOM {
  clear() {
    batch_write(() => {
      this._dom["innerHTML"] = "";
    });
  }

  insert(index, x) {
    batch_write(() => {
      const children = this._dom["children"];
      const len = children["length"];

      // TODO test this
      if (index < 0) {
        index += len + 1;
      }

      // TODO test this
      if (index === len) {
        this._dom["appendChild"](x._dom);

      } else if (index >= 0 && index < len) {
        this._dom["insertBefore"](x._dom, children[index]);

      } else {
        throw new Error("Invalid index: " + index);
      }
    });
  }

  remove(index) {
    batch_write(() => {
      const children = this._dom["children"];
      const len = children["length"];

      // TODO test this
      if (index < 0) {
        index += len;
      }

      // TODO test this
      if (index >= 0 && index < len) {
        this._dom["removeChild"](children[index]);

      } else {
        throw new Error("Invalid index: " + index);
      }
    });
  }

  push(x) {
    batch_write(() => {
      this._dom["appendChild"](x._dom);
    });
  }
}


export const style = (o) => make_style(o);

export const animation = (o) => make_animation(o);

// TODO code duplication
export const gradient = (x, ...args) => {
  const r = [x];

  each(args, ([x, y]) => {
    r["push"](y + " " + x);
  });

  return "linear-gradient(" + r["join"](",") + ")"
};

// TODO code duplication
export const repeating_gradient = (x, ...args) => {
  const r = [x];

  each(args, ([x, y]) => {
    r["push"](y + " " + x);
  });

  return "repeating-linear-gradient(" + r["join"](",") + ")"
};

export const hsl = (hue, sat, light, alpha = 1) => {
  if (alpha === 1) {
    return "hsl(" + hue + ", " + sat + "%, " + light + "%)"
  } else {
    return "hsla(" + hue + ", " + sat + "%, " + light + "%, " + alpha + ")"
  }
};

const row_style = style({
  "display": "flex",
  "flex-direction": "row",
  "align-items": "center"
});

const col_style = style({
  "display": "flex",
  "flex-direction": "column"
});

const stretch_style = style({
  "flex-shrink": "1",
  "flex-grow": "1",
  "flex-basis": "0%"
});

export const row = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e.add_style(row_style);
  f(e);
  return e;
};

export const stretch = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e.add_style(stretch_style);
  f(e);
  return e;
};

export const col = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e.add_style(col_style);
  f(e);
  return e;
};

export const text = (s) => new Text(s);

export const image = (f) => {
  const e = new Image(document["createElement"]("img"));
  f(e);
  return e;
};

export const main = col((e) => {});

// TODO use batch_write ?
// TODO a little hacky
document["body"]["appendChild"](main._dom);
