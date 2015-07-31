import { each, entries } from "../util/iterator";
import { Ref, always } from "../util/mutable/ref";
import { List } from "../util/mutable/list";
import { uuid_list_insert,
         uuid_list_update,
         uuid_list_remove,
         uuid_list_clear } from "../util/mutable/list";
import { batch_read, batch_write } from "./dom/batch";
import { set_style, make_style, make_animation } from "./dom/style";
import { assert, fail } from "../util/assert";


const preventDefault = (e) => {
  e["preventDefault"]();
};


const mouse_event = (e) => {
  return {
    x: e["clientX"],
    y: e["clientY"],
    alt: e["altKey"],
    ctrl: e["ctrlKey"], // TODO what about Macs ?
    shift: e["shiftKey"]
  };
};

class Element {
  constructor(dom) {
    this._dom = dom;
    this._running = [];

    this._animations = [];
  }

  _run(x) {
    this._running["push"](x);
  }

/*
  // TODO is this correct ?
  copy() {
    return new this.constructor(this._dom["cloneNode"](true));
  }*/

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

  set_style(style, ref) {
    return ref.each((x) => {
      if (x) {
        this._add_style(style);
      } else {
        this._remove_style(style);
      }
    });
  }

  // TODO
  scroll_to(ref) {
    /*return ref.each((x) => {
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
    });*/
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

  animate(animation, info) {
    this._animations["push"]({
      animation: animation,
      info: info
    });
  }

  _trigger_relayout() {
    // TODO is there a "faster" way to trigger relayout ?
    getComputedStyle(this._dom)["left"];
  }

  // TODO test this
  _wait_animation(a, f) {
    if (a["length"]) {
      let pending = 0;

      const start = (e) => {
        ++pending;
      };

      const end = (e) => {
        --pending;

        if (pending === 0) {
          // TODO remove vendor prefix
          this._dom["removeEventListener"]("webkitAnimationStart", start, true);
          this._dom["removeEventListener"]("webkitAnimationEnd", end, true);
          f();
        }
      };

      // TODO remove vendor prefix
      this._dom["addEventListener"]("webkitAnimationStart", start, true);
      this._dom["addEventListener"]("webkitAnimationEnd", end, true);

    } else {
      f();
    }
  }

  // TODO test this
  _get_animations(f) {
    const out = [];

    each(this._animations, ({ animation, info }) => {
      const type = f(info);

      // TODO a tiny bit hacky
      if (type) {
        if (type === "play-to") {
          out["push"](animation._name + " " +
                      animation._duration + " " +
                      animation._easing +
                      " 0ms 1 normal both running");

        } else if (type === "play-from") {
          out["push"](animation._name + " " +
                      animation._duration + " " +
                      animation._easing +
                      " 0ms 1 reverse both running");

        } else if (type === "set-to") {
          out["push"](animation._name + " 0ms linear 0ms 1 normal both paused");

        } else if (type === "set-from") {
          out["push"](animation._name + " 0ms linear 0ms 1 reverse both paused");

        } else {
          fail();
        }
      }
    });

    return out;
  }

  // TODO test this
  _animate(a) {
    // TODO remove vendor prefix
    set_style(this._dom["style"], "-webkit-animation", null);

    if (a["length"]) {
      // TODO hacky, but I don't know of any other way to make it work
      this._trigger_relayout();

      // TODO remove vendor prefix
      // TODO code duplication
      set_style(this._dom["style"], "-webkit-animation", a["join"](","));
    }
  }

  /*animate_when(ref, info) {
    return ref.each((x) => {
      if (x) {
        // TODO this should be stopped when the `animate_when` is stopped
        this.animate(info);
      }
    });
  }*/

  visible(ref) {
    return ref.each((x) => {
      if (x) {
        this._dom["style"]["display"] = "";
      } else {
        this._dom["style"]["display"] = "none";
      }
    });
  }

  // TODO test this
  style(o) {
    // TODO replace with `Set` ?
    const stops = [];

    // TODO is this inefficient ?
    each(entries(o), ([key, ref]) => {
      /*
      // TODO can this be made more efficient ?
      if (key === "transform") {
        const keys = [];
        const refs = [];

        each(entries(ref), ([key, ref]) => {
          keys["push"](key);
          refs["push"](ref);
        });

        // TODO a little hacky ?
        ref = latest(refs, (...values) => {
          // TODO use a consistent order for the keys ?
          const value = keys["map"]((key, i) => key + "(" + values[i] + ")");
          return value["join"](" ");
        });
      }*/

      // TODO a little hacky
      stops["push"](ref.each((x) => {
        // TODO test this
        set_style(this._dom["style"], key, x);
      }));
    });

    return {
      stop: () => {
        // TODO a little hacky
        stops["forEach"]((x) => {
          x.stop();
        });
      }
    };
  }
}


class Image extends Element {
  url(ref) {
    return ref.each((x) => {
      this._dom["src"] = x;
    });
  }
}


class Text extends Element {
  value(ref) {
    return ref.each((x) => {
      this._dom["textContent"] = x;
    });
  }
}


class Parent extends Element {
  constructor(dom) {
    super(dom);

    this._children = new List();
  }

  // TODO is this correct ? it probably needs to trigger various things on the child elements
  _clear() {
    this._children.clear();
    this._dom["innerHTML"] = "";
  }

  _remove(index) {
    const child = this._children.get(index);
    this._children.remove(index);

    const a = child._get_animations((x) => x.remove);

    child._wait_animation(a, () => {
      this._dom["removeChild"](child._dom);
    });

    child._animate(a);
  }

  _update(index, x) {
    this._dom["replaceChild"](x._dom, this._children.get(index)._dom);
    this._children.update(index, x);
  }

  _insert(index, x) {
    // TODO is this correct ?
    if (this._children.has(index)) {
      this._dom["insertBefore"](x._dom, this._children.get(index)._dom);

    } else {
      this._dom["appendChild"](x._dom);
    }

    this._children.insert(index, x);

    const a = x._get_animations((x) => x.insert);

    x._animate(a);
  }

  _push(x) {
    this._dom["appendChild"](x._dom);
    this._children.push(x);

    const a = x._get_animations((x) => x.initial);

    x._animate(a);
  }

  // TODO is this correct ?
  set_children(x) {
    return x.each((x) => {
      this._clear();

      each(x, (x) => {
        this._push(x);
      });
    });
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

class Row extends Parent {
  /*_update_transform() {
    // TODO this can be made more efficient
    each(indexed(this._children), ([i, x]) => {
      x._dom["style"]["position"] = "absolute";
      x._dom["style"]["transform"] = "translate3d(" + (i * 100) + "%, 0px, 0px)";
    });
  }

  _remove(index) {
    super._remove(index);
    this._update_transform();
  }

  _update(index, x) {
    super._update(index, x);
    this._update_transform();
  }

  _insert(index, x) {
    super._insert(index, x);
    this._update_transform();
  }

  _push(x) {
    super._push(x);
    this._update_transform();
  }*/
}

class Col extends Parent {
  /*_update_transform() {
    // TODO this can be made more efficient
    each(indexed(this._children), ([i, x]) => {
      x._dom["style"]["position"] = "absolute";
      x._dom["style"]["transform"] = "translate3d(0px, " + (i * 100) + "%, 0px)";
    });
  }

  _remove(index) {
    super._remove(index);
    this._update_transform();
  }

  _update(index, x) {
    super._update(index, x);
    this._update_transform();
  }

  _insert(index, x) {
    super._insert(index, x);
    this._update_transform();
  }

  _push(x) {
    super._push(x);
    this._update_transform();
  }*/
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

export const transition = (o) => {
  const out = [];

  each(entries(o), ([key, { duration, easing = "linear" }]) => {
    out["push"](key + " " + duration + " " + easing);
  });

  return out["join"](", ");
};

const floating_style = style({
  "position": always("fixed"),
  "z-index": always("9001") // TODO highest z-index
});

const row_style = style({
  "display": always("flex"),
  "flex-direction": always("row"),
  "align-items": always("center"), // TODO get rid of this ?
});

const col_style = style({
  "display": always("flex"),
  "flex-direction": always("column"),
});

export const stretch = style({
  "flex-shrink": always("1"),
  "flex-grow": always("1"),
  "flex-basis": always("0%"),

  // TODO is this correct ?
  "overflow": always("hidden"),
  "white-space": always("nowrap")
});

const main_style = style({
  "width": always("100%"),
  "height": always("100%")
});

export const row = (f) => {
  const e = new Row(document["createElement"]("div"));
  e._add_style(row_style);
  // TODO test this
  e._running = e._running["concat"](f(e));
  return e;
};

export const col = (f) => {
  const e = new Col(document["createElement"]("div"));
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
export const text = (f) => {
  const e = new Text(document["createElement"]("div"));
  e._running = e._running["concat"](f(e));
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
  e.set_style(main_style, always(true)));

export const main = (x) => {
  // TODO hacky
  _main._dom["appendChild"](x._dom);
};

// TODO use batch_write ?
// TODO a little hacky
document["body"]["appendChild"](_main._dom);
document["body"]["appendChild"](panels);
