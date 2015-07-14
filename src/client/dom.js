import { each } from "../util/iterator";
import { Signal, Stream, empty } from "../util/stream";
import { batch_read, batch_write } from "./dom/batch";
import { make_style, make_animation } from "./dom/style";
import { assert, fail } from "../util/assert";
import { async, async_callback } from "../util/async";
import { animate, ease_in_out, range, round_range } from "../util/animate";


// TODO can this be made more efficient ?
const parse_css = (x) =>
  /^([0-9]+)(px)?$/["exec"](x);

const range_px = (t, from, to) =>
  round_range(t, from, to) + "px";

const parse_range = (key, from, to) => {
  const x = parse_css(from._style[key]);
  const y = parse_css(to._style[key]);

  if (x[2] && y[2]) {
    return {
      key: key,
      from: +x[1],
      to: +y[1],
      range: range_px
    };

  } else if (!x[2] && !y[2]) {
    return {
      key: key,
      from: +x[1],
      to: +y[1],
      range: range
    };

  } else {
    fail();
  }
};


let holding = null;

const preventDefault = (e) => {
  e["preventDefault"]();
};

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);

class DOM {
  constructor(dom) {
    this._dom = dom;
    this._running = null;

    // TODO what if there are multiple draggers ?
    this._dragging = false;

    // TODO figure out some way to opt into this
    this.hovering = new Signal(false);
    this.holding  = new Signal(false);

    // TODO code duplication
    const mouseover = (e) => {
      if (!this._dragging) {
        if (holding === null || this._dom["contains"](holding)) {
          const related = e["relatedTarget"];

          if (related === null || !this._dom["contains"](related)) {
            this.hovering.set(true);
          }
        }
      }
    };

    // TODO code duplication
    const mouseout = (e) => {
      if (!this._dragging) {
        if (holding === null || this._dom["contains"](holding)) {
          const related = e["relatedTarget"];

          if (related === null || !this._dom["contains"](related)) {
            this.hovering.set(false);
          }
        }
      }
    };

    this._dom["addEventListener"]("mouseover", mouseover, true);
    this._dom["addEventListener"]("mouseout", mouseout, true);


    const mousedown = () => {
      holding = this._dom;
      // TODO is it possible for this to leak ?
      addEventListener("mouseup", mouseup, true);
      this.holding.set(true);
    };

    const mouseup = () => {
      holding = null;
      removeEventListener("mouseup", mouseup, true);
      this.holding.set(false);
    };

    this._dom["addEventListener"]("mousedown", mousedown, true);
  }

  // TODO code duplication
  on_left_click() {
    return Stream((send, error, complete) => {
      const click = (e) => {
        if (e["button"] === 0) {
          send({
            x: e["clientX"],
            y: e["clientY"]
          });
        }
      };

      this._dom["addEventListener"]("click", click, true);

      return () => {
        this._dom["removeEventListener"]("click", click, true);
      };
    });
  }

  // TODO code duplication
  on_middle_click() {
    return Stream((send, error, complete) => {
      const click = (e) => {
        if (e["button"] === 1) {
          send({
            x: e["clientX"],
            y: e["clientY"]
          });
        }
      };

      this._dom["addEventListener"]("click", click, true);

      return () => {
        this._dom["removeEventListener"]("click", click, true);
      };
    });
  }

  on_right_click() {
    return Stream((send, error, complete) => {
      const click = (e) => {
        if (e["button"] === 2) {
          send({
            x: e["clientX"],
            y: e["clientY"]
          });
        }
      };

      this._dom["addEventListener"]("contextmenu", preventDefault, true);
      this._dom["addEventListener"]("mousedown", click, true);

      return () => {
        this._dom["removeEventListener"]("contextmenu", preventDefault, true);
        this._dom["removeEventListener"]("mousedown", click, true);
      };
    });
  }

  drag_source({ start, move, end, threshold }) {
    return Stream((send, error, complete) => {
      let info = null;
      let start_x = null;
      let start_y = null;

      const mousedown = (e) => {
        if (e["button"] === 0) {
          // TODO is it possible for these to leak ?
          addEventListener("mousemove", mousemove, true);
          addEventListener("mouseup", mouseup, true);

          start_x = e["clientX"];
          start_y = e["clientY"];
        }
      };

      const mousemove = (e) => {
        const x = e["clientX"];
        const y = e["clientY"];

        if (this._dragging) {
          info = move(info, { x, y });

        } else if (hypot(start_x - x, start_y - y) > threshold) {
          this._dragging = true;

          this._dom["style"]["pointer-events"] = "none";

          info = start({ x, y });

          this.hovering.set(true);
          this.holding.set(false);
        }
      };

      const mouseup = (e) => {
        removeEventListener("mousemove", mousemove, true);
        removeEventListener("mouseup", mouseup, true);

        start_x = null;
        start_y = null;

        if (this._dragging) {
          this._dragging = false;

          this._dom["style"]["pointer-events"] = "";

          const x = e["clientX"];
          const y = e["clientY"];

          const old_info = info;

          info = null;

          end(old_info, { x, y });

          this.hovering.set(false);
          this.holding.set(false);
        }
      };

      this._dom["addEventListener"]("mousedown", mousedown, true);

      return () => {
        this._dom["removeEventListener"]("mousedown", mousedown, true);
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
      this._dom["classList"]["add"](style._name);
      //this.add_style(style);
    } else {
      this._dom["classList"]["remove"](style._name);
      //this.remove_style(style);
    }
  }

  // TODO test this
  animate({ from, to, duration }) {
    // TODO a bit inefficient ?
    each(from._keys, (key) => {
      assert(to._style[key]);
    });

    // TODO should this use `map` ?
    const transitions = to._keys["map"]((key) => {
      assert(from._style[key]);

      return parse_range(key, from, to);
    });

    return animate(duration).map(ease_in_out).map((t) => {
      /*if (t === 1) {
        for (let i = 0; i < transitions["length"]; ++i) {
          const { key } = transitions[i];
          this._dom["style"][key] = "";
        }

      } else {*/
        // TODO can this be made more efficient ?
        for (let i = 0; i < transitions["length"]; ++i) {
          const { key, from, to, range } = transitions[i];
          this._dom["style"][key] = range(t, from, to);
        }
      //}

      return t;
    });
  }

  // TODO is this correct ?
  copy() {
    return new this.constructor(this._dom["cloneNode"](true));
  }

  show() {
    this._dom["style"]["display"] = "";
  }

  hide() {
    this._dom["style"]["display"] = "none";
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

class Floating extends Parent {
  set_top(y) {
    this._dom["style"]["top"] = y + "px";
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

const floating_style = style({
  "position": "fixed",
  "z-index": "1"
});

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
  // TODO test this
  e._running = f(e).run();
  return e;
};

export const stretch = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e.add_style(stretch_style);
  // TODO test this
  e._running = f(e).run();
  return e;
};

export const col = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e.add_style(col_style);
  // TODO test this
  e._running = f(e).run();
  return e;
};

// TODO not quite right...
export const floating = (f) => {
  const e = new Floating(document["createElement"]("div"));
  e.add_style(floating_style);
  // TODO test this
  e._running = f(e).run();
  // TODO is this correct ?
  panels["appendChild"](e._dom);
  return e;
};

export const text = (s) => new Text(s);

export const image = (f) => {
  const e = new Image(document["createElement"]("img"));
  // TODO test this
  e._running = f(e).run();
  return e;
};

const panels = document["createElement"]("div");

export const main = col((e) => {
  return empty;
});

// TODO use batch_write ?
// TODO a little hacky
document["body"]["appendChild"](main._dom);
document["body"]["appendChild"](panels);
