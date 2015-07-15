import { each } from "../util/iterator";
import { Ref, Stream, empty } from "../util/stream";
import { List } from "../util/immutable/list";
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


const preventDefault = (e) => {
  e["preventDefault"]();
};

// TODO move this into another module
// TODO better implementation of this ?
const hypot = (x, y) =>
  Math["sqrt"](x * x + y * y);


// TODO what if there are multiple draggers ?
export const dragging = new Ref(false);


class DOM {
  constructor(dom) {
    this._dom = dom;
    this._parent = null;
  }

  get parent() {
    return this._parent;
  }

  // TODO a bit inefficient
  _remove() {
    const parent = this._parent;

    if (parent !== null) {
      const index = parent._children.index_of(this).get();
      parent._children = parent._children.remove(index);
      parent._dom["removeChild"](this._dom);
      this._parent = null;
    }
  }

/*
  // TODO is this correct ?
  copy() {
    return new this.constructor(this._dom["cloneNode"](true));
  }*/
}


class Text extends DOM {
  get text() {
    return this._dom["textContent"];
  }

  set text(value) {
    this._dom["textContent"] = value;
  }
}


class Element extends DOM {
  constructor(dom) {
    super(dom);

    this._running = null;
  }

  on_mouse_hover() {
    return Stream((send, error, complete) => {
      // TODO code duplication
      const mouseover = (e) => {
        const related = e["relatedTarget"];

        // This is done to simulate "mouseenter"
        if (related === null || !this._dom["contains"](related)) {
          send({
            x: e["clientX"],
            y: e["clientY"]
          });
        }
      };

      // TODO code duplication
      const mouseout = (e) => {
        const related = e["relatedTarget"];

        // This is done to simulate "mouseleave"
        if (related === null || !this._dom["contains"](related)) {
          send(null);
        }
      };

      this._dom["addEventListener"]("mouseover", mouseover, true);
      this._dom["addEventListener"]("mouseout", mouseout, true);

      return () => {
        this._dom["removeEventListener"]("mouseover", mouseover, true);
        this._dom["removeEventListener"]("mouseout", mouseout, true);
      };
    });
  }

  on_mouse_hold() {
    return Stream((send, error, complete) => {
      const mousedown = (e) => {
        // TODO is it possible for this to leak ?
        addEventListener("mouseup", mouseup, true);
        send({
          x: e["clientX"],
          y: e["clientY"]
        });
      };

      const mouseup = () => {
        removeEventListener("mouseup", mouseup, true);
        send(null);
      };

      this._dom["addEventListener"]("mousedown", mousedown, true);

      return () => {
        this._dom["removeEventListener"]("mousedown", mousedown, true);
        removeEventListener("mouseup", mouseup, true);
      };
    });
  }

  hovering() {
    return this.on_mouse_hover().initial(null);
  }

  holding() {
    return this.on_mouse_hold().initial(null);
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

  on_mouse_move() {
    return Stream((send, error, complete) => {
      const mousemove = (e) => {
        send({
          x: e["clientX"],
          y: e["clientY"]
        });
      };

      this._dom["addEventListener"]("mousemove", mousemove, true);

      return () => {
        this._dom["removeEventListener"]("mousemove", mousemove, true);
      };
    });
  }

  on_drag_hover() {
    return this.on_mouse_hover().keep((x) => x && dragging.value);
  }

  drag({ start, move, end, threshold }) {
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

        if (dragging.value) {
          info = move(info, { x, y });

        } else if (hypot(start_x - x, start_y - y) > threshold) {
          dragging.value = true;

          info = start({ x, y });
        }
      };

      const mouseup = (e) => {
        removeEventListener("mousemove", mousemove, true);
        removeEventListener("mouseup", mouseup, true);

        start_x = null;
        start_y = null;

        if (dragging.value) {
          dragging.value = false;

          const x = e["clientX"];
          const y = e["clientY"];

          const old_info = info;

          info = null;

          end(old_info, { x, y });
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
      //assert(!this._dom["classList"]["contains"](style._name));
      this._dom["classList"]["add"](style._name);
    });
  }

  remove_style(style) {
    batch_write(() => {
      //assert(this._dom["classList"]["contains"](style._name));
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

  // TODO test this
  animate({ from, to, duration, easing = (x) => x }) {
    // TODO a bit inefficient ?
    each(from._keys, (key) => {
      assert(to._style[key]);
    });

    // TODO should this use `map` ?
    const transitions = to._keys["map"]((key) => {
      assert(from._style[key]);

      return parse_range(key, from, to);
    });

    return animate(duration).map(easing).map((t) => {
      // TODO what about bouncing ?
      if (t === 1) {
        this.add_style(to);

        for (let i = 0; i < transitions["length"]; ++i) {
          const { key } = transitions[i];
          this._dom["style"][key] = "";
        }

      } else {
        if (t === 0) {
          // TODO remove `to` as well ?
          this.remove_style(from);
        }

        // TODO can this be made more efficient ?
        for (let i = 0; i < transitions["length"]; ++i) {
          const { key, from, to, range } = transitions[i];
          this._dom["style"][key] = range(t, from, to);
        }
      }

      return t;
    });
  }

  show() {
    this._dom["style"]["display"] = "";
  }

  hide() {
    this._dom["style"]["display"] = "none";
  }
}


class Image extends Element {
  set url(s) {
    this._dom["src"] = s;
  }
}


class Parent extends Element {
  constructor(dom) {
    super(dom);

    this._children = List();
  }

  get children() {
    return this._children;
  }

  // TODO is this correct ? maybe it should use `_remove` ?
  clear() {
    this._children = List();
    this._dom["innerHTML"] = "";
  }

  remove(index) {
    // TODO this can be implemented more efficiently
    this._children.get(index)._remove();
  }

  insert(index, x) {
    x._remove();

    // TODO is this correct ?
    if (this._children.has(index)) {
      this._dom["insertBefore"](x._dom, this._children.get(index)._dom);

    } else {
      this._dom["appendChild"](x._dom);
    }

    this._children = this._children.insert(index, x);
    x._parent = this;
  }

  push(x) {
    x._remove();

    this._dom["appendChild"](x._dom);

    this._children = this._children.push(x);
    x._parent = this;
  }

  index_of(x) {
    return this._children.index_of(x);
  }
}

class Floating extends Parent {
  set left(x) {
    this._dom["style"]["left"] = x + "px";
  }
  set top(x) {
    this._dom["style"]["top"] = x + "px";
  }
  set width(x) {
    this._dom["style"]["width"] = x + "px";
  }
  set height(x) {
    this._dom["style"]["height"] = x + "px";
  }
}


export const style = (o) => make_style(o);

export const animation = (o) => make_animation(o);

export const calc = (...args) =>
  "calc(" + args["join"](" ") + ")";

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

export const text = (s) =>
  new Text(document["createTextNode"](s));

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
