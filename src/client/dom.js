import { each, entries } from "../util/iterator";
import { Set } from "../util/mutable/set";
import { Ref, always } from "../util/ref";
import { List } from "../util/mutable/list";
import { uuid_stream_insert,
         uuid_stream_update,
         uuid_stream_remove,
         uuid_stream_clear } from "../util/mutable/stream";
import { set_style, make_style,
         make_animation, make_stylesheet } from "./dom/style";
import { assert, fail } from "../util/assert";


const preventDefault = (e) => {
  e["preventDefault"]();
};


const mouse_event = (dom, e) => {
  return {
    x: e["clientX"],
    y: e["clientY"],
    alt: e["altKey"],
    ctrl: e["ctrlKey"], // TODO what about Macs ?
    shift: e["shiftKey"],
    subtree: (e["target"] !== dom) // TODO a little hacky
  };
};


let element_id = 0;

class Element {
  constructor(dom) {
    this._id = ++element_id;
    this._dom = dom;
    this._running = new Set();
    this._animations = new Set();
    this._visible = true;
    this._hovering = null;
    this._holding = null;
    this._scroll_left = null;
    this._scroll_top = null;
    this._scroll_to_initial = false;
    this._scroll_to_insert = false;
  }

  // TODO test this
  _on_remove(parent) {
    each(this._running, (x) => {
      x.stop();
    });

    assert(this._animations.size === 0);

    this._id = null;
    this._dom = null;
    this._running = null;
    this._animations = null;
    this._visible = null;
    this._hovering = null;
    this._holding = null;
    this._scroll_left = null;
    this._scroll_top = null;
    this._scroll_to_initial = null;
    this._scroll_to_insert = null;
  }

  _on_insert(parent, type) {
    // TODO is this inefficient ?
    if (this._scroll_left !== null) {
      // TODO this triggers a relayout
      const width = this._dom["scrollWidth"] - this._dom["clientWidth"];

      if (width !== 0) {
        // TODO does this trigger a relayout ?
        this._dom["scrollLeft"] = width * this._scroll_left;
      }
    }

    // TODO is this inefficient ?
    if (this._scroll_top !== null) {
      // TODO this triggers a relayout
      const height = this._dom["scrollHeight"] - this._dom["clientHeight"];

      if (height !== 0) {
        // TODO does this trigger a relayout ?
        this._dom["scrollTop"] = height * this._scroll_top;
      }
    }


    if (type === "initial") {
      if (this._scroll_to_initial) {
        parent._scroll_to(this);
      }


    } else if (type === "insert") {
      if (this._scroll_to_insert) {
        parent._scroll_to(this);
      }


    } else {
      fail();
    }
  }

  _scroll_to(child) {
    const p = this.get_position();
    const c = child.get_position();

    // TODO test this
    // TODO does this trigger a relayout ?
    this._dom["scrollLeft"] +=
      Math["round"]((c.left - p.left) -
                    (p.width / 2) +
                    (c.width / 2));

    // TODO does this trigger a relayout ?
    this._dom["scrollTop"] +=
      Math["round"]((c.top - p.top) -
                    (p.height / 2) +
                    (c.height / 2));
  }

  _run(x) {
    this._running.insert(x);
  }

  // TODO a tiny bit hacky
  noop() {
    return {
      stop: () => {}
    };
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
        send(mouse_event(this._dom, e));
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
      send(mouse_event(this._dom, e));
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
    if (this._hovering === null) {
      this._hovering = new Ref(null);

      // TODO a little hacky
      this._run(this.on_mouse_hover((hover) => {
        this._hovering.set(hover);
      }));
    }

    return this._hovering;
  }

  holding() {
    if (this._holding === null) {
      this._holding = new Ref(null);

      // TODO a little hacky
      this._run(this.on_mouse_hold((hold) => {
        this._holding.set(hold);
      }));
    }

    return this._holding;
  }

  on_scroll(send) {
    // TODO is this inefficient ?
    const scroll = (e) => {
      if (e["target"] === this._dom) {
        // TODO does this trigger a relayout ?
        const width  = this._dom["scrollWidth"]  - this._dom["clientWidth"];
        const height = this._dom["scrollHeight"] - this._dom["clientHeight"];

        send({
          x: (width  === 0 ? 0 : this._dom["scrollLeft"] / width),
          y: (height === 0 ? 0 : this._dom["scrollTop"] / height)
        });
      }
    };

    this._dom["addEventListener"]("scroll", scroll, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("scroll", scroll, true);
      }
    };
  }

  // TODO code duplication
  on_left_click(send) {
    const click = (e) => {
      if (e["button"] === 0) {
        send(mouse_event(this._dom, e));
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
        send(mouse_event(this._dom, e));
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
        send(mouse_event(this._dom, e));
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

  on_focus(send) {
    this._dom["tabIndex"] = 0;

    const focus = (e) => {
      if (e["target"] === this._dom) {
        send(true);
      }
    };

    const blur = (e) => {
      if (e["target"] === this._dom) {
        send(false);
      }
    };

    this._dom["addEventListener"]("focus", focus, true);
    this._dom["addEventListener"]("blur", blur, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("focus", focus, true);
        this._dom["removeEventListener"]("blur", blur, true);
      }
    };
  }

  /*on_mouse_move(send) {
    const mousemove = (e) => {
      send(mouse_event(this._dom, e));
    };

    this._dom["addEventListener"]("mousemove", mousemove, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("mousemove", mousemove, true);
      }
    };
  }*/

  draggable({ start, move, end, start_if }) {
    let start_x = null;
    let start_y = null;
    let dragging = false;

    const mousedown = (e) => {
      if (e["button"] === 0) {
        start_x = e["clientX"];
        start_y = e["clientY"];

        const o = mouse_event(this._dom, e);

        if (start_if(start_x, start_y, o)) {
          dragging = true;

          start(o);
        }

        // TODO is it possible for these to leak ?
        addEventListener("mousemove", mousemove, true);
        addEventListener("mouseup", mouseup, true);
      }
    };

    const mousemove = (e) => {
      const o = mouse_event(this._dom, e);

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

        end(mouse_event(this._dom, e));
      }
    };

    this._dom["addEventListener"]("mousedown", mousedown, true);

    return {
      // TODO is this correct ?
      stop: () => {
        this._dom["removeEventListener"]("mousedown", mousedown, true);
        removeEventListener("mousemove", mousemove, true);
        removeEventListener("mouseup", mouseup, true);
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

  // TODO test this
  set_scroll({ x, y }) {
    const r1 = x.each((x) => {
      this._scroll_left = x;

      // TODO is this needed ?
      //this._dom["scrollLeft"] = x;
    });

    const r2 = y.each((y) => {
      this._scroll_top = y;

      // TODO is this needed ?
      //this._dom["scrollTop"] = y;
    });

    return {
      // TODO test this
      stop: () => {
        r1.stop();
        r2.stop();
      }
    };
  }

  scroll_to(info) {
    const running = new Set();

    if (info.initial) {
      running.insert(info.initial.each((x) => {
        this._scroll_to_initial = x;
      }));
    }

    if (info.insert) {
      running.insert(info.insert.each((x) => {
        this._scroll_to_insert = x;
      }));
    }

    return {
      // TODO test this
      stop: () => {
        each(running, (x) => {
          x.stop();
        });
      }
    };
  }

  get_position() {
    // TODO this triggers a relayout
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
    const x = {
      animation: animation,
      info: info
    };

    this._animations.insert(x);

    // TODO test this
    return {
      stop: () => {
        this._animations.remove(x);
      }
    };
  }

  _trigger_relayout(s) {
    // TODO this triggers a relayout
    // TODO is there a "faster" way to trigger relayout ?
    getComputedStyle(this._dom)[s];
  }

  // TODO this isn't quite correct, but it will do for now
  _wait_for_animation(a, done) {
    const dom = this._dom;

    let pending = a["length"];

    const cleanup = () => {
      clearTimeout(timer);
      // TODO remove vendor prefix
      dom["removeEventListener"]("webkitAnimationEnd", end, true);
    };

    const end = (e) => {
      if (e["target"] === dom) {
        --pending;

        if (pending === 0) {
          cleanup();
          done();
        }
      }
    };

    const error = () => {
      cleanup();
      fail(new Error("Animation took too long!"));
    };

    // TODO is it possible for these to leak ?
    // TODO remove vendor prefix
    dom["addEventListener"]("webkitAnimationEnd", end, true);

    const timer = setTimeout(error, 10000);
  }

  // TODO test this
  _animate(fill, f, done = null) {
    const a = this._get_animations(fill, f);

    if (a["length"]) {
      // TODO is this correct ?
      // TODO remove vendor prefix
      set_style(this._dom["style"], "-webkit-animation", null);

      // TODO hacky, but I don't know of any other way to make it work
      this._trigger_relayout("-webkit-animation");

      if (done != null) {
        this._wait_for_animation(a, done);
      }

      // TODO remove vendor prefix
      // TODO code duplication
      set_style(this._dom["style"], "-webkit-animation", a["join"](","));

    // TODO should this set "-webkit-animation" to `null` ?
    } else if (done != null) {
      done();
    }
  }

  // TODO test this
  _get_animations(fill, f) {
    const out = [];

    if (this._visible) {
      each(this._animations, ({ animation, info }) => {
        const type = f(info);

        // TODO a tiny bit hacky
        if (type) {
          if (type === "play-to") {
            out["push"](animation._name + " " +
                        animation._duration + " " +
                        animation._easing +
                        " 0ms 1 normal " +
                        fill +
                        " running");

          } else if (type === "play-from") {
            out["push"](animation._name + " " +
                        animation._duration + " " +
                        animation._easing +
                        " 0ms 1 reverse " +
                        fill +
                        " running");

          } else {
            fail();
          }
        }
      });
    }

    return out;
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
        this._visible = true;
        set_style(this._dom["style"], "display", null);
      } else {
        this._visible = false;
        set_style(this._dom["style"], "display", "none");
      }
    });
  }

  tooltip(ref) {
    return ref.each((x) => {
      if (x === null) {
        this._dom["title"] = "";
      } else {
        this._dom["title"] = x;
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
        // TODO test this
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
      if (x === null) {
        this._dom["src"] = "";

      } else {
        this._dom["src"] = x;
      }
    });
  }
}


class Iframe extends Element {
  // TODO code duplication
  url(ref) {
    return ref.each((x) => {
      if (x === null) {
        // TODO is this correct ?
        this._dom["src"] = "";

      } else {
        this._dom["src"] = x;
      }
    });
  }
}


class Text extends Element {
  value(ref) {
    return ref.each((x) => {
      if (x === null) {
        this._dom["textContent"] = "";

      } else {
        this._dom["textContent"] = x;
      }
    });
  }
}


class TextBox extends Element {
  value(ref) {
    return ref.each((x) => {
      if (x === null) {
        this._dom["value"] = "";

      } else {
        this._dom["value"] = x;
      }
    });
  }

  on_change(send) {
    let timer = null;

    const input = () => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        send(this._dom["value"]);
      }, 300);
    };

    this._dom["addEventListener"]("input", input, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("input", input, true);
      }
    };
  }
}


class SearchBox extends TextBox {
  on_change(send) {
    const search = () => {
      send(this._dom["value"]);
    };

    this._dom["addEventListener"]("search", search, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("search", search, true);
      }
    };
  }
}


class Checkbox extends Element {
  checked(ref) {
    return ref.each((x) => {
      if (x) {
        this._dom["checked"] = true;
      } else {
        this._dom["checked"] = false;
      }
    });
  }

  on_change(send) {
    const change = () => {
      send(this._dom["checked"]);
    };

    this._dom["addEventListener"]("change", change, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("change", change, true);
      }
    };
  }
}


class Radio extends Checkbox {
  name(ref) {
    return ref.each((x) => {
      if (x === null) {
        // TODO is this correct ?
        this._dom["name"] = "";

      } else {
        this._dom["name"] = x;
      }
    });
  }
}


class Parent extends Element {
  constructor(dom) {
    super(dom);

    this._children = new List();
  }

  _on_remove(parent) {
    each(this._children, (x) => {
      x._on_remove(this);
    });

    // TODO is this in the right order ?
    super._on_remove(parent);
  }

  // TODO test this
  _on_insert(parent, type) {
    // TODO is this in the right order ?
    super._on_insert(parent, type);

    // TODO is this correct ?
    each(this._children, (x) => {
      x._on_insert(this, type);
    });
  }

  // TODO test this
  _animate(fill, f, done = null) {
    if (this._visible) {
      let pending = this._children.size + 1;

      const done2 = (done == null
                      ? null
                      : () => {
                          --pending;

                          if (pending === 0) {
                            done();
                          }
                        });

      super._animate(fill, f, done2);

      // TODO this is a bit broken;
      //      e.g. try setting the "tab remove" animation to 5000ms,
      //      then remove tabs 1 by 1 until the group is removed,
      //      then look in console and wait 10 seconds
      each(this._children, (x) => {
        x._animate(fill, f, done2);
      });

    } else if (done != null) {
      done();
    }
  }

  // TODO test this
  _clear() {
    if (this._children.size) {
      each(this._children, (x) => {
        x._on_remove(this);
      });

      this._children.clear();
      this._dom["innerHTML"] = "";
    }
  }

  _remove(index) {
    const child = this._children.get(index);
    this._children.remove(index);

    const parent_dom = this._dom;
    const child_dom  = child._dom;

    // TODO test this
    child._animate("both", (x) => x.remove, () => {
      parent_dom["removeChild"](child_dom);
    });

    child._on_remove(this);
  }

  // TODO test this
  _update(index, x) {
    this._remove(index);
    this._insert(index, x);
  }

  _insert(index, x) {
    // TODO is this correct ?
    if (this._children.has(index)) {
      this._dom["insertBefore"](x._dom, this._children.get(index)._dom);

    } else {
      this._dom["appendChild"](x._dom);
    }

    this._children.insert(index, x);

    x._on_insert(this, "insert");

    x._animate("none", (x) => x.insert);
  }

  _push(x) {
    this._dom["appendChild"](x._dom);
    this._children.push(x);

    x._on_insert(this, "initial");

    x._animate("none", (x) => x.initial);
  }

  // TODO is this correct ?
  children(x) {
    // TODO a tiny bit hacky
    if (Array["isArray"](x)) {
      each(x, (x) => {
        this._push(x);
      });

      // TODO noop function
      return {
        stop: () => {}
      };

    } else {
      return x.each((x) => {
        this._clear();

        if (x !== null) {
          each(x, (x) => {
            this._push(x);
          });
        }
      });
    }
  }

  stream(x) {
    each(x, (x) => {
      this._push(x);
    });

    return x.on_change((x) => {
      switch (x.type) {
      case uuid_stream_insert:
        this._insert(x.index, x.value);
        break;

      case uuid_stream_update:
        this._update(x.index, x.value);
        break;

      case uuid_stream_remove:
        this._remove(x.index);
        break;

      case uuid_stream_clear:
        this._clear();
        break;

      default:
        fail();
        break;
      }
    });
  }
}


class Select extends Parent {
  value(ref) {
    return ref.each((x) => {
      if (x === null) {
        this._dom["selectedIndex"] = -1;

      } else {
        this._dom["value"] = x;
      }
    });
  }

  on_change(send) {
    const change = () => {
      send(this._dom["value"]);
    };

    this._dom["addEventListener"]("change", change, true);

    return {
      stop: () => {
        this._dom["removeEventListener"]("change", change, true);
      }
    };
  }
}

class Optgroup extends Parent {
  label(ref) {
    return ref.each((x) => {
      if (x === null) {
        this._dom["label"] = "";

      } else {
        this._dom["label"] = x;
      }
    });
  }
}

class Option extends Element {
  // TODO code duplication
  label(ref) {
    return ref.each((x) => {
      if (x === null) {
        this._dom["label"] = "";

      } else {
        this._dom["label"] = x;
      }
    });
  }

  value(ref) {
    return ref.each((x) => {
      if (x === null) {
        this._dom["value"] = "";

      } else {
        this._dom["value"] = x;
      }
    });
  }
}


export const style = (o) => make_style(o);

export const animation = (o) => make_animation(o);

export const stylesheet = (n, o) => make_stylesheet(n, o);

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
export const radial_gradient = (x, ...args) => {
  const r = [x];

  each(args, ([x, y]) => {
    r["push"](y + " " + x);
  });

  return "radial-gradient(" + r["join"](",") + ")"
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

  each(entries(o), ([key, { duration, easing }]) => {
    out["push"](key + " " + duration + " " + easing);
  });

  return out["join"](", ");
};

export const floating = style({
  "position": always("fixed"),
  "z-index": always("2147483647") // 32-bit signed int
});

export const row = style({
  "display": always("flex"),
  "flex-direction": always("row"),
  "align-items": always("center"), // TODO get rid of this ?
});

export const col = style({
  "display": always("flex"),
  "flex-direction": always("column"),
});

export const stretch = style({
  "flex-shrink": always("1"),
  "flex-grow": always("1"),
  "flex-basis": always("0%"),
});

export const child = (f) => {
  const e = new Element(document["createElement"]("div"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const parent = (f) => {
  const e = new Parent(document["createElement"]("div"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const label = (f) => {
  const e = new Parent(document["createElement"]("label"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

// TODO is this correct ?
export const text = (f) => {
  const e = new Text(document["createElement"]("div"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const select = (f) => {
  const e = new Select(document["createElement"]("select"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const optgroup = (f) => {
  const e = new Optgroup(document["createElement"]("optgroup"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const option = (f) => {
  const e = new Option(document["createElement"]("option"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const image = (f) => {
  const e = new Image(document["createElement"]("img"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const iframe = (f) => {
  const e = new Iframe(document["createElement"]("iframe"));

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const checkbox = (f) => {
  const x = document["createElement"]("input");

  x["type"] = "checkbox";

  const e = new Checkbox(x);

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const radio = (f) => {
  const x = document["createElement"]("input");

  x["type"] = "radio";

  const e = new Radio(x);

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const search = (f) => {
  const x = document["createElement"]("input");

  // TODO a bit hacky, this should probably be configurable
  x["autofocus"] = true;

  // TODO test these
  x["type"] = "search";
  x["incremental"] = true;
  x["autocomplete"] = "off";
  x["placeholder"] = "Search";
  x["setAttribute"]("results", "");

  const e = new SearchBox(x);

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};

export const textbox = (f) => {
  const x = document["createElement"]("input");

  x["type"] = "text";

  const e = new TextBox(x);

  each(f(e), (x) => {
    e._run(x);
  });

  return e;
};


// TODO should we use `pointer-events: none` while scrolling, to make it smoother ?
const body = new Parent(document["body"]);

export const main = (x) => {
  // TODO test this
  body._push(x);
};

export const title = (ref) => {
  return ref.each((x) => {
    document["title"] = x;
  });
};
