import { each } from "../util/iterator";
import { Ref, always } from "../util/mutable/ref";
import { List } from "../util/immutable/list";
import { uuid_list_insert,
         uuid_list_update,
         uuid_list_remove,
         uuid_list_clear } from "../util/mutable/list";
import { batch_read, batch_write } from "./dom/batch";
import { make_style } from "./dom/style";
import { assert, fail } from "../util/assert";
import { async, async_callback } from "../util/async";
import { animate, range, round_range, ease_in_out } from "../util/animate";


// TODO can this be made more efficient ?
const parse_css = (x) =>
  /^(\-?(?:[0-9]+\.)?[0-9]+)(px)?$/["exec"](x);

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


class DOM {
  constructor(dom) {
    this._dom = dom;
    this._parent = null;
    this._running = [];
  }

  _run(x) {
    this._running["push"](x);
  }

  get parent() {
    return this._parent;
  }

  // TODO a bit inefficient
  _remove_self() {
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


const mouse_event = (e) => {
  return {
    x: e["clientX"],
    y: e["clientY"],
    alt: e["altKey"],
    ctrl: e["ctrlKey"], // TODO what about Macs ?
    shift: e["shiftKey"]
  };
};

class Element extends DOM {
  on_mouse_hover(send) {
    // TODO code duplication
    const mouseover = (e) => {
      const related = e["relatedTarget"];

      // This is done to simulate "mouseenter"
      if (related === null || !this._dom["contains"](related)) {
        send(mouse_event(e));
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

    return {
      stop: () => {
        this._dom["removeEventListener"]("mouseover", mouseover, true);
        this._dom["removeEventListener"]("mouseout", mouseout, true);
      }
    };
  }

  on_mouse_hold(send) {
    const mousedown = (e) => {
      // TODO is it possible for this to leak ?
      addEventListener("mouseup", mouseup, true);
      send(mouse_event(e));
    };

    const mouseup = () => {
      removeEventListener("mouseup", mouseup, true);
      send(null);
    };

    this._dom["addEventListener"]("mousedown", mousedown, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("mousedown", mousedown, true);
        removeEventListener("mouseup", mouseup, true);
      }
    };
  }

  hovering() {
    const x = new Ref(null);

    this._run(this.on_mouse_hover((hover) => {
      x.set(hover);
    }));

    return x;
  }

  holding() {
    const x = new Ref(null);

    this._run(this.on_mouse_hold((hold) => {
      x.set(hold);
    }));

    return x;
  }

  // TODO code duplication
  on_left_click(send) {
    const click = (e) => {
      if (e["button"] === 0) {
        send(mouse_event(e));
      }
    };

    this._dom["addEventListener"]("click", click, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("click", click, true);
      }
    };
  }

  // TODO code duplication
  on_middle_click(send) {
    const click = (e) => {
      if (e["button"] === 1) {
        send(mouse_event(e));
      }
    };

    this._dom["addEventListener"]("click", click, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("click", click, true);
      }
    };
  }

  on_right_click(send) {
    const click = (e) => {
      if (e["button"] === 2) {
        send(mouse_event(e));
      }
    };

    this._dom["addEventListener"]("contextmenu", preventDefault, true);
    this._dom["addEventListener"]("mousedown", click, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("contextmenu", preventDefault, true);
        this._dom["removeEventListener"]("mousedown", click, true);
      }
    };
  }

  on_mouse_move(send) {
    const mousemove = (e) => {
      send(mouse_event(e));
    };

    this._dom["addEventListener"]("mousemove", mousemove, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("mousemove", mousemove, true);
      }
    };
  }

  draggable({ start, move, end, start_if }) {
    let start_x = null;
    let start_y = null;
    let dragging = false;

    const mousedown = (e) => {
      if (e["button"] === 0) {
        // TODO is it possible for these to leak ?
        addEventListener("mousemove", mousemove, true);
        addEventListener("mouseup", mouseup, true);

        start_x = e["clientX"];
        start_y = e["clientY"];

        const o = mouse_event(e);

        if (start_if(start_x, start_y, o)) {
          dragging = true;

          start(o);
        }
      }
    };

    const mousemove = (e) => {
      const o = mouse_event(e);

      if (dragging) {
        move(o);

      } else if (start_if(start_x, start_y, o)) {
        dragging = true;

        start(o);
      }
    };

    const mouseup = (e) => {
      removeEventListener("mousemove", mousemove, true);
      removeEventListener("mouseup", mouseup, true);

      start_x = null;
      start_y = null;

      if (dragging) {
        dragging = false;

        end(mouse_event(e));
      }
    };

    this._dom["addEventListener"]("mousedown", mousedown, true);

    return {
      // TODO what about `mousemove` and `mouseup` ?
      stop: () => {
        this._dom["removeEventListener"]("mousedown", mousedown, true);
      }
    };
  }

  _add_style(style) {
    this._dom["classList"]["add"](style._name);
  }

  _remove_style(style) {
    this._dom["classList"]["remove"](style._name);
  }

  style(style, ref) {
    return ref.each((x) => {
      if (x) {
        this._add_style(style);
      } else {
        this._remove_style(style);
      }
    });
  }

  scroll_to(ref) {
    return ref.each((x) => {
      // TODO it should scroll to the element immediately after being inserted
      if (x && this._parent) {
        const p = this._parent.get_position();
        const c = this.get_position();

        // TODO test this
        this._parent._dom["scrollLeft"] +=
          Math["round"]((c.left - p.left) -
                        (p.width / 2) +
                        (c.width / 2));

        this._parent._dom["scrollTop"] +=
          Math["round"]((c.top - p.top) -
                        (p.height / 2) +
                        (c.height / 2));
      }
    });
  }

  get_position() {
    const box = this._dom["getBoundingClientRect"]();
    return {
      left: box["left"],
      top: box["top"],
      right: box["right"],
      bottom: box["bottom"],
      width: box["width"],
      height: box["height"]
    };
  }

  // TODO test this
  animate({ from, to, duration, easing = ease_in_out }) {
    // TODO a bit inefficient ?
    each(from._keys, (key) => {
      assert(to._style[key]);
    });

    // TODO should this use `map` ?
    const transitions = to._keys["map"]((key) => {
      assert(from._style[key]);

      return parse_range(key, from, to);
    });

    return animate(duration, (t1) => {
      const t2 = easing(t1);

      // TODO what about bouncing ?
      if (t2 === 1) {
        this._add_style(to);

        for (let i = 0; i < transitions["length"]; ++i) {
          const { key } = transitions[i];
          this._dom["style"][key] = "";
        }

      } else {
        if (t2 === 0) {
          // TODO remove `to` as well ?
          this._remove_style(from);
        }

        // TODO can this be made more efficient ?
        for (let i = 0; i < transitions["length"]; ++i) {
          const { key, from, to, range } = transitions[i];
          this._dom["style"][key] = range(t2, from, to);
        }
      }
    });
  }

  animate_when(ref, info) {
    return ref.each((x) => {
      if (x) {
        // TODO this should be stopped when the `animate_when` is stopped
        this.animate(info);
      }
    });
  }

  visible(ref) {
    return ref.each((x) => {
      if (x) {
        this._dom["style"]["display"] = "";
      } else {
        this._dom["style"]["display"] = "none";
      }
    });
  }

  set_style(key, ref) {
    return ref.each((x) => {
      // TODO check that the style is valid
      this._dom["style"][key] = x;
    });
  }
}


class Image extends Element {
  url(ref) {
    return ref.each((x) => {
      this._dom["src"] = x;
    });
  }
}


class Parent extends Element {
  constructor(dom) {
    super(dom);

    this._children = List();
  }

  // TODO is this correct ? maybe it should use `_remove_self` ?
  _clear() {
    this._children = List();
    this._dom["innerHTML"] = "";
  }

  _remove(index) {
    const child = this._children.get(index);

    assert(child._parent === this);

    this._children = this._children.remove(index);
    this._dom["removeChild"](child._dom);
    child._parent = null;
  }

  _update(index, x) {
    x._remove_self();

    this._dom["replaceChild"](x._dom, this._children.get(index)._dom);

    this._children = this._children.update(index, x);
    x._parent = this;
  }

  _insert(index, x) {
    x._remove_self();

    // TODO is this correct ?
    if (this._children.has(index)) {
      this._dom["insertBefore"](x._dom, this._children.get(index)._dom);

    } else {
      this._dom["appendChild"](x._dom);
    }

    this._children = this._children.insert(index, x);
    x._parent = this;
  }

  _push(x) {
    x._remove_self();

    this._dom["appendChild"](x._dom);

    this._children = this._children.push(x);
    x._parent = this;
  }

  children(x) {
    each(x, (x) => {
      this._push(x);
    });

    // TODO hacky
    if (Array["isArray"](x)) {
      return {
        stop: () => {}
      };

    } else {
      return x.on_change((x) => {
        switch (x.type) {
        case uuid_list_insert:
          this._insert(x.index, x.value);
          break;

        case uuid_list_update:
          this._update(x.index, x.value);
          break;

        case uuid_list_remove:
          this._remove(x.index);
          break;

        case uuid_list_clear:
          this._clear();
          break;

        default:
          fail();
          break;
        }
      });
    }
  }
}

class Floating extends Parent {
  // TODO change these to accept a Stream as input ?
  /*set left(x) {
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
  }*/
}


export const style = (o) => make_style(o);

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
  "z-index": "9001" // TODO highest z-index
});

const row_style = style({
  "display": "flex",
  "flex-direction": "row",
  "align-items": "center", // TODO get rid of this ?
});

const col_style = style({
  "display": "flex",
  "flex-direction": "column",
});

const stretch_style = style({
  "flex-shrink": "1",
  "flex-grow": "1",
  "flex-basis": "0%",

  // TODO is this correct ?
  "overflow": "hidden",
  "white-space": "nowrap"
});

const main_style = style({
  "width": "100%",
  "height": "100%"
});

export const row = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e._add_style(row_style);
  // TODO test this
  e._running = e._running["concat"](f(e));
  return e;
};

export const stretch = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e._add_style(stretch_style);
  // TODO test this
  e._running = e._running["concat"](f(e));
  return e;
};

export const col = (f) => {
  const e = new Parent(document["createElement"]("div"));
  e._add_style(col_style);
  // TODO test this
  e._running = e._running["concat"](f(e));
  return e;
};

// TODO not quite right...
export const floating = (f) => {
  const e = new Floating(document["createElement"]("div"));
  e._add_style(floating_style);
  e._add_style(col_style); // TODO is this correct ?
  // TODO test this
  e._running = e._running["concat"](f(e));
  // TODO is this correct ?
  panels["appendChild"](e._dom);
  return e;
};

// TODO is this correct ?
export const text = (x) => {
  const s = document["createTextNode"]("");
  const e = new DOM(s);

  // TODO is this correct ?
  e._run(x.each((x) => {
    s["textContent"] = x;
  }));

  return e;
};

export const image = (f) => {
  const e = new Image(document["createElement"]("img"));
  // TODO test this
  e._running = e._running["concat"](f(e));
  return e;
};

const panels = document["createElement"]("div");

const _main = col((e) =>
  e.style(main_style, always(true)));

export const main = (x) => {
  // TODO hacky
  _main._dom["appendChild"](x._dom);
};

// TODO use batch_write ?
// TODO a little hacky
document["body"]["appendChild"](_main._dom);
document["body"]["appendChild"](panels);
