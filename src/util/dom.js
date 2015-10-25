import * as set from "./set";
import * as ref from "./ref";
import * as list from "./list";
import * as running from "./running";
import * as record from "./record";
import * as _stream from "./stream";
import * as functions from "./functions";
import * as async from "./async";
import { assert, crash } from "./assert";
import { get_style_value, set_style_value,
         make_style, make_stylesheet } from "./dom/style";
import { batch_read, batch_write } from "./dom/batch";
import { animate as _animate, make_animation } from "./dom/animate/css";

export { make_style, make_stylesheet } from "./dom/style";
export { make_animation } from "./dom/animate/css";


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

/*
// TODO this triggers a relayout
const trigger_relayout = (dom, s) => {
  // TODO is there a "faster" way to trigger relayout ?
  getComputedStyle(dom)[s];
};*/


let element_id = 0;

const make = (type, dom, children) => {
  return {
    _id: ++element_id,
    _type: type,
    _dom: dom,
    _children: children,
    _running: null,
    _parent: null,
    _animations: null,
    _visible: true,
    _inserted: null,
    _hovering: null,
    _holding: null
  };
};

const make_tag = (type, tag, children, f) => {
  const e = make(type, document["createElement"](tag), children);

  e._running = f(e);

  return e;
};

const _on_remove1 = (dom, parent, animate, done) => {
  assert(dom._id !== null);
  assert(dom._dom !== null);
  assert(dom._parent !== null);
  assert(dom._parent === parent);

  // TODO what if the child node is visible but the parent node is not ?
  if (animate) {
    // TODO is this the right order for this ?
    _animate(dom, (x) => x.remove, done);
  } else {
    done();
  }

  if (dom._animations !== null) {
    assert(set.size(dom._animations) !== 0);
  }

  list.each(dom._running, running.stop);

  if (dom._animations !== null) {
    assert(set.size(dom._animations) === 0);
  }

  dom._id = null;
  dom._type = null;
  dom._dom = null;
  dom._children = null;
  dom._running = null;
  dom._parent = null;
  dom._animations = null;
  dom._visible = null;
  dom._inserted = null; // TODO does this leak ?
  dom._hovering = null; // TODO does this leak ?
  dom._holding = null; // TODO does this leak ?
};

// TODO test this
const _on_remove = (dom, parent, animate, done) => {
  if (dom._children === null) {
    _on_remove1(dom, parent, animate, done);

  } else {
    let pending = list.size(dom._children) + 1;

    const done2 = () => {
      --pending;

      if (pending === 0) {
        done();
      }
    };

    // TODO this is a bit broken;
    //      e.g. try setting the "tab remove" animation to 5000ms,
    //      then remove tabs 1 by 1 until the group is removed,
    //      then look in console and wait 10 seconds
    list.each(dom._children, (x) => {
      // TODO a bit hacky
      _on_remove(x, dom, animate && x._visible, done2);
    });

    // TODO is this in the right order ?
    _on_remove1(dom, parent, animate, done2);
  }
};

const _on_insert = (dom, parent, animate, type) => {
  assert(dom._dom !== null);
  assert(dom._parent === null);
  assert(parent !== null);

  dom._parent = parent;

  if (dom._inserted !== null) {
    ref.set(dom._inserted, type);
  }


  if (type === "initial") {
    // TODO what if the child node is visible but the parent node is not ?
    if (animate) {
      // TODO is this the right order for this ?
      _animate(dom, (x) => x.initial);
    }


  } else if (type === "insert") {
    // TODO what if the child node is visible but the parent node is not ?
    if (animate) {
      // TODO is this the right order for this ?
      _animate(dom, (x) => x.insert);
    }


  } else {
    crash();
  }


  // TODO test this
  // TODO this doesn't seem quite right: it gets called multiple times when the element is initially pushed
  // TODO is this in the right order ?
  if (dom._children !== null) {
    // TODO is this correct ?
    list.each(dom._children, (x) => {
      // TODO a bit hacky
      _on_insert(x, dom, animate && x._visible, type);
    });
  }
};

const _run = (dom, x) => {
  list.push(dom._running, x);
};


const _on_inserted = (dom) => {
  if (dom._inserted === null) {
    // TODO is it possible for this to run after the element is inserted ?
    dom._inserted = ref.make(null);
  }

  return dom._inserted;
};

// TODO a tiny bit hacky
export const noop = running.noop;


// TODO use batch_read ?
// TODO handle blur ?
export const on_mouse_hover = (dom, send) => {
  // TODO code duplication
  const mouseover = (e) => {
    const related = e["relatedTarget"];

    // This is done to simulate "mouseenter"
    if (related === null || !dom._dom["contains"](related)) {
      send(mouse_event(dom._dom, e));
    }
  };

  // TODO code duplication
  const mouseout = (e) => {
    const related = e["relatedTarget"];

    // This is done to simulate "mouseleave"
    if (related === null || !dom._dom["contains"](related)) {
      send(null);
    }
  };

  dom._dom["addEventListener"]("mouseover", mouseover, true);
  dom._dom["addEventListener"]("mouseout", mouseout, true);

  return running.make(() => {
    dom._dom["removeEventListener"]("mouseover", mouseover, true);
    dom._dom["removeEventListener"]("mouseout", mouseout, true);
  });
};

// TODO use batch_read ?
export const on_mouse_hold = (dom, send) => {
  const mousedown = (e) => {
    // TODO is it possible for this to leak ?
    addEventListener("mouseup", mouseup, true);
    send(mouse_event(dom._dom, e));
  };

  const mouseup = () => {
    removeEventListener("mouseup", mouseup, true);
    send(null);
  };

  dom._dom["addEventListener"]("mousedown", mousedown, true);

  return running.make(() => {
    dom._dom["removeEventListener"]("mousedown", mousedown, true);
    removeEventListener("mouseup", mouseup, true);
  });
};

export const hovering = (dom) => {
  if (dom._hovering === null) {
    dom._hovering = ref.make(null);

    // TODO a little hacky
    _run(dom, on_mouse_hover(dom, (hover) => {
      ref.set(dom._hovering, hover);
    }));
  }

  return dom._hovering;
};

export const holding = (dom) => {
  if (dom._holding === null) {
    dom._holding = ref.make(null);

    // TODO a little hacky
    _run(dom, on_mouse_hold(dom, (hold) => {
      ref.set(dom._holding, hold);
    }));
  }

  return dom._holding;
};

// TODO use batch_read ?
export const on_scroll = (dom, send) => {
  // TODO is this inefficient ?
  const scroll = (e) => {
    if (e["target"] === dom._dom) {
      // TODO does this trigger a relayout ?
      const width  = dom._dom["scrollWidth"]  - dom._dom["clientWidth"];
      const height = dom._dom["scrollHeight"] - dom._dom["clientHeight"];

      send({
        x: (width  === 0 ? 0 : dom._dom["scrollLeft"] / width),
        y: (height === 0 ? 0 : dom._dom["scrollTop"] / height)
      });
    }
  };

  dom._dom["addEventListener"]("scroll", scroll, true);

  return running.make(() => {
    dom._dom["removeEventListener"]("scroll", scroll, true);
  });
};

// TODO code duplication
// TODO use batch_read ?
export const on_left_click = (dom, send) => {
  const click = (e) => {
    if (e["button"] === 0) {
      preventDefault(e);
      send(mouse_event(dom._dom, e));
    }
  };

  dom._dom["addEventListener"]("click", click, true);

  return running.make(() => {
    dom._dom["removeEventListener"]("click", click, true);
  });
};

// TODO code duplication
// TODO use batch_read ?
export const on_middle_click = (dom, send) => {
  const click = (e) => {
    if (e["button"] === 1) {
      preventDefault(e);
      send(mouse_event(dom._dom, e));
    }
  };

  dom._dom["addEventListener"]("click", click, true);

  return running.make(() => {
    dom._dom["removeEventListener"]("click", click, true);
  });
};

// TODO use batch_read ?
export const on_right_click = (dom, send) => {
  const click = (e) => {
    if (e["button"] === 2) {
      // TODO is this correct ?
      preventDefault(e);
      send(mouse_event(dom._dom, e));
    }
  };

  dom._dom["addEventListener"]("contextmenu", preventDefault, true);
  dom._dom["addEventListener"]("mousedown", click, true);

  return running.make(() => {
    dom._dom["removeEventListener"]("contextmenu", preventDefault, true);
    dom._dom["removeEventListener"]("mousedown", click, true);
  });
};

// TODO use batch_read ?
export const on_focus = (dom, send) => {
  dom._dom["tabIndex"] = 0;

  const focus = (e) => {
    if (e["target"] === dom._dom) {
      send(true);
    }
  };

  // TODO is this correct ?
  const blur = (e) => {
    if (e["target"] === dom._dom) {
      send(false);
    }
  };

  dom._dom["addEventListener"]("focus", focus, true);
  dom._dom["addEventListener"]("blur", blur, true);

  return running.make(() => {
    dom._dom["removeEventListener"]("focus", focus, true);
    dom._dom["removeEventListener"]("blur", blur, true);
  });
};

// TODO use batch_read ?
export const draggable = (dom, { start, move, end, start_if }) => {
  let start_x = null;
  let start_y = null;
  let dragging = false;

  const mousedown = (e) => {
    if (e["button"] === 0) {
      start_x = e["clientX"];
      start_y = e["clientY"];

      const o = mouse_event(dom._dom, e);

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
    const o = mouse_event(dom._dom, e);

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

      end(mouse_event(dom._dom, e));
    }
  };

  dom._dom["addEventListener"]("mousedown", mousedown, true);

  // TODO is this correct ?
  return running.make(() => {
    dom._dom["removeEventListener"]("mousedown", mousedown, true);
    removeEventListener("mousemove", mousemove, true);
    removeEventListener("mouseup", mouseup, true);
  });
};

export const add_style = (dom, style) => {
  assert(style._type === 0);

  assert(!dom._dom["classList"]["contains"](style._name));
  dom._dom["classList"]["add"](style._name);

  return running.noop();
};

export const toggle_style = (dom, style, x) => {
  assert(style._type === 0);

  let first = true;

  return ref.listen(x, (x) => {
    if (x) {
      assert(!dom._dom["classList"]["contains"](style._name));
      dom._dom["classList"]["add"](style._name);

    } else {
      assert(first || dom._dom["classList"]["contains"](style._name));
      dom._dom["classList"]["remove"](style._name);
    }

    first = false;
  });
};

// TODO test this
export const set_scroll = (dom, { x, y }) =>
    // TODO does this leak memory ?
  ref.listen(ref.latest([
    _on_inserted(dom),
    x,
    y
  ], (inserted, x, y) => {
    if (inserted !== null) {
      return { x, y };

    } else {
      return null;
    }

  }), (info) => {
    if (info !== null) {
      batch_read(() => {
        // TODO does this trigger a relayout ?
        const width = dom._dom["scrollWidth"] -
                      dom._dom["clientWidth"];

        const height = dom._dom["scrollHeight"] -
                       dom._dom["clientHeight"];

        batch_write(() => {
          // TODO what if x is null ?
          dom._dom["scrollLeft"] = info.x * width;

          // TODO what if y is null ?
          dom._dom["scrollTop"]  = info.y * height;
        });
      });
    }
  });

// TODO could use a better name
export const scroll_to = (dom, { initial = ref.always(false),
                                 insert  = ref.always(false) }) =>
  // TODO does this leak memory ?
  ref.listen(ref.latest([
    _on_inserted(dom),
    initial,
    insert
  ], (inserted, initial, insert) => {
    return (inserted === "initial" && initial) ||
           (inserted === "insert"  && insert);

  }), (scroll) => {
    if (scroll) {
      _scroll_to(dom._parent, dom);
    }
  });

// This triggers a relayout, so you should always run it in `batch_read`
const _get_position = (dom) => {
  const box = dom._dom["getBoundingClientRect"]();

  return {
    left: box["left"],
    top: box["top"],
    right: box["right"],
    bottom: box["bottom"],
    width: box["width"],
    height: box["height"]
  };
};

export const get_position = (dom) => {
  const out = async.make();

  batch_read(() => {
    async.success(out, _get_position(dom));
  });

  return out;
};

export const animate = (dom, animation, info) => {
  assert(animation._type === 1);

  const x = {
    animation: animation,
    info: info
  };

  if (dom._animations === null) {
    dom._animations = set.make();
  }

  set.insert(dom._animations, x);

  // TODO test this
  return running.make(() => {
    set.remove(dom._animations, x);
  });
};

const _scroll_to = (parent, child) => {
  // TODO is this correct ?
  // TODO what if the child is visible but the parent isn't ?
  // TODO move this check inside of the batch_read ?
  if (child._visible) {
    batch_read(() => {
      const p = _get_position(parent);
      const c = _get_position(child);

      const scrollLeft = parent._dom["scrollLeft"];
      const scrollTop  = parent._dom["scrollTop"];

      batch_write(() => {
        // TODO test this
        // TODO does this trigger a relayout ?
        parent._dom["scrollLeft"] = scrollLeft +
          Math["round"]((c.left - p.left) -
                        (p.width / 2) +
                        (c.width / 2));

        // TODO does this trigger a relayout ?
        parent._dom["scrollTop"] = scrollTop +
          Math["round"]((c.top - p.top) -
                        (p.height / 2) +
                        (c.height / 2));
      });
    });
  }
};

export const toggle_visible = (dom, x) => {
  let first = true;

  return ref.listen(x, (x) => {
    if (x) {
      assert(first || dom._visible === false);
      dom._visible = true;
      set_style_value(dom._dom["style"], "display", null);

    } else {
      assert(dom._visible === true);
      dom._visible = false;
      set_style_value(dom._dom["style"], "display", "none");
    }

    first = false;
  });
};

// TODO does this trigger a relayout ?
export const set_tooltip = (dom, x) =>
  ref.listen(x, (x) => {
    if (x === null) {
      dom._dom["title"] = "";
    } else {
      dom._dom["title"] = x;
    }
  });

// TODO test this
export const style = (dom, o) => {
  const stops = list.make();

  record.each(o, (key, x) => {
    /*
    // TODO can this be made more efficient ?
    if (key === "transform") {
      const keys = [];
      const refs = [];

      record.each(ref, (key, ref) => {
        keys["push"](key);
        refs["push"](ref);
      });

      // TODO a little hacky ?
      ref = latest(refs, (...values) => {
        // TODO use a consistent order for the keys ?
        const value = list.map(keys, (key, i) => key + "(" + values[i] + ")");
        return list.join(value, " ");
      });
    }*/

    // TODO a little hacky
    list.push(stops, ref.listen(x, (x) => {
      // TODO test this
      set_style_value(dom._dom["style"], key, x);
    }));
  });

  return running.make(() => {
    // TODO a little hacky
    // TODO test this
    list.each(stops, running.stop);
  });
};


// TODO does this trigger a relayout ?
export const set_alt = (dom, x) => {
  if (dom._type === "img") {
    return ref.listen(x, (x) => {
      if (x === null) {
        // TODO is this correct ?
        dom._dom["alt"] = "";

      } else {
        dom._dom["alt"] = x;
      }
    });

  } else {
    crash();
  }
};

// TODO does this trigger a relayout ?
export const set_url = (dom, x) => {
  if (dom._type === "img" || dom._type === "iframe") {
    return ref.listen(x, (x) => {
      // TODO is this needed?
      // TODO is this done for performance reasons?
      // TODO does this prevent a crash in Chrome when there's a lot of tabs?
      // TODO this should probably only batch <img> and not batch <iframe>
      batch_write(() => {
        if (x === null) {
          // TODO is this correct ?
          dom._dom["src"] = "";

        } else {
          dom._dom["src"] = x;
        }
      });
    });

  } else if (dom._type === "a") {
    return ref.listen(x, (x) => {
      if (x === null) {
        // TODO is this correct ?
        dom._dom["href"] = "";

      } else {
        dom._dom["href"] = x;
      }
    });

  } else {
    crash();
  }
};

// TODO does this trigger a relayout ?
export const set_target = (dom, x) => {
  if (dom._type === "a") {
    return ref.listen(x, (x) => {
      if (x === null) {
        // TODO is this correct ?
        dom._dom["target"] = "";

      } else {
        dom._dom["target"] = x;
      }
    });

  } else {
    crash();
  }
};

// TODO does this trigger a relayout ?
export const set_value = (dom, x) => {
  if (dom._type === "text" || dom._type === "a") {
    return ref.listen(x, (x) => {
      if (x === null) {
        dom._dom["textContent"] = "";

      } else {
        dom._dom["textContent"] = x;
      }
    });

  } else if (dom._type === "textbox" ||
             dom._type === "option" ||
             dom._type === "search") {
    return ref.listen(x, (x) => {
      if (x === null) {
        dom._dom["value"] = "";

      } else {
        dom._dom["value"] = x;
      }
    });

  } else if (dom._type === "select") {
    return ref.listen(x, (x) => {
      if (x === null) {
        dom._dom["selectedIndex"] = -1;

      } else {
        dom._dom["value"] = x;
      }
    });

  } else {
    crash();
  }
};

// TODO use batch_read ?
export const on_change = (dom, send) => {
  if (dom._type === "textbox") {
    let timer = null;

    const input = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = null;

        send(dom._dom["value"]);
      }, 300);
    };

    dom._dom["addEventListener"]("input", input, true);

    return running.make(() => {
      dom._dom["removeEventListener"]("input", input, true);
    });


  } else if (dom._type === "search") {
    const search = () => {
      send(dom._dom["value"]);
    };

    dom._dom["addEventListener"]("search", search, true);

    return running.make(() => {
      dom._dom["removeEventListener"]("search", search, true);
    });


  } else if (dom._type === "checkbox" ||
             dom._type === "radio") {
    const change = () => {
      send(dom._dom["checked"]);
    };

    dom._dom["addEventListener"]("change", change, true);

    return running.make(() => {
      dom._dom["removeEventListener"]("change", change, true);
    });


  } else if (dom._type === "select") {
    const change = () => {
      send(dom._dom["value"]);
    };

    dom._dom["addEventListener"]("change", change, true);

    return running.make(() => {
      dom._dom["removeEventListener"]("change", change, true);
    });


  } else {
    crash();
  }
};

// TODO does this trigger a relayout ?
export const toggle_checked = (dom, x) => {
  if (dom._type === "checkbox" ||
      dom._type === "radio") {

    let first = true;

    // TODO handle indeterminate state
    return ref.listen(x, (x) => {
      if (x) {
        assert(!dom._dom["checked"]);
        dom._dom["checked"] = true;

      } else {
        assert(first || dom._dom["checked"]);
        dom._dom["checked"] = false;
      }

      first = false;
    });

  } else {
    crash();
  }
};

// TODO does this trigger a relayout ?
export const set_name = (dom, x) => {
  if (dom._type === "radio") {
    return ref.listen(x, (x) => {
      if (x === null) {
        // TODO is this correct ?
        dom._dom["name"] = "";

      } else {
        dom._dom["name"] = x;
      }
    });

  } else {
    crash();
  }
};

// TODO does this trigger a relayout ?
export const set_label = (dom, x) => {
  if (dom._type === "optgroup" || dom._type === "option") {
    return ref.listen(x, (x) => {
      if (x === null) {
        dom._dom["label"] = "";

      } else {
        dom._dom["label"] = x;
      }
    });

  } else {
    crash();
  }
};


const check_children = (dom) => {
  assert(list.size(dom._children) === dom._dom["childNodes"]["length"]);
};

// TODO test this
// TODO what about animations ?
const _clear = (dom) => {
  list.each(dom._children, (x) => {
    // TODO test this
    // TODO this is probably wrong
    _on_remove(x, dom, x._visible, functions.noop);
  });

  list.clear(dom._children);
  // TODO maybe use "removeChild" rather than doing it like this ?
  dom._dom["innerHTML"] = "";

  check_children(dom);
};

const _remove = (dom, index) => {
  const child = list.get(dom._children, index);
  list.remove(dom._children, index);

  const child_dom = child._dom;

  _on_remove(child, dom, child._visible, () => {
    dom._dom["removeChild"](child_dom);
  });
};

// TODO test this
const _update = (dom, index, x) => {
  _remove(dom, index);
  _insert(dom, index, x);
};

const _insert = (dom, index, x) => {
  // TODO is this correct ?
  // TODO test this
  if (list.has(dom._children, index)) {
    const child = list.get(dom._children, index);
    dom._dom["insertBefore"](x._dom, child._dom);

  } else {
    dom._dom["appendChild"](x._dom);
  }

  list.insert(dom._children, index, x);

  // Only run this if the node is actually in the DOM
  if (dom._parent !== null) {
    _on_insert(x, dom, x._visible, "insert");
  }
};

const _push = (dom, x) => {
  dom._dom["appendChild"](x._dom);

  list.push(dom._children, x);

  // Only run this if the node is actually in the DOM
  if (dom._parent !== null) {
    _on_insert(x, dom, x._visible, "initial");
  }
};

// TODO test this
const _children = (dom, x) => {
  let first = true;

  let old_keys = record.make();

  return ref.listen(x, (x) => {
    if (first) {
      first = false;

      if (x !== null) {
        list.each(x, (child) => {
          record.insert(old_keys, child._id, true);
          _push(dom, child);
        });
      }

    } else {
      const new_keys = record.make();

      const new_children =
        (x === null
          ? list.make()
          : list.map(x, (child) => {
              record.insert(new_keys, child._id, true);

              // TODO is this correct ?
              dom._dom["appendChild"](child._dom);

              // TODO test this
              // If the child is new...
              if (!record.has(old_keys, child._id)) {
                // TODO code duplication
                // TODO test this
                // Only run this if the node is actually in the DOM
                if (dom._parent !== null) {
                  // TODO is this correct ?
                  _on_insert(child, dom, child._visible, "initial");
                }
              }

              return child;
            }));

      list.each(dom._children, (child) => {
        // If the child no longer exists...
        if (!record.has(new_keys, child._id)) {
          // TODO code duplication
          const child_dom = child._dom;

          // TODO is this correct ?
          _on_remove(child, dom, false, () => {
            dom._dom["removeChild"](child_dom);
          });
        }
      });

      old_keys = new_keys;
      dom._children = new_children;

      // TODO is this the correct spot for this ?
      check_children(dom);
    }
  });
};

// TODO is this correct ?
export const children = (dom, x) => {
  // TODO a tiny bit hacky
  if (Array["isArray"](x)) {
    list.each(x, (x) => {
      _push(dom, x);
    });

    return running.noop();

  } else {
    return _children(dom, x);
  }
};

export const stream = (dom, x) =>
  _stream.listen(x, (x) => {
    switch (record.get(x, "type")) {
    case _stream.uuid_initial:
      list.each(record.get(x, "value"), (x) => {
        _push(dom, x);
      });
      break;

    case _stream.uuid_insert:
      _insert(dom, record.get(x, "index"), record.get(x, "value"));
      break;

    case _stream.uuid_update:
      _update(dom, record.get(x, "index"), record.get(x, "value"));
      break;

    case _stream.uuid_remove:
      _remove(dom, record.get(x, "index"));
      break;

    case _stream.uuid_clear:
      _clear(dom);
      break;

    default:
      crash();
      break;
    }
  });


// TODO code duplication
export const gradient = (x, ...args) => {
  const r = list.make(x);

  list.each(args, ([x, y]) => {
    list.push(r, y + " " + x);
  });

  return "linear-gradient(" + list.join(r, ",") + ")";
};

// TODO code duplication
export const radial_gradient = (x, ...args) => {
  const r = list.make(x);

  list.each(args, ([x, y]) => {
    list.push(r, y + " " + x);
  });

  return "radial-gradient(" + list.join(r, ",") + ")";
};

// TODO code duplication
export const repeating_gradient = (x, ...args) => {
  const r = list.make(x);

  list.each(args, ([x, y]) => {
    list.push(r, y + " " + x);
  });

  return "repeating-linear-gradient(" + list.join(r, ",") + ")";
};

export const hsl = (hue, sat, light, alpha = 1) => {
  if (alpha === 1) {
    return "hsl(" + hue + ", " + sat + "%, " + light + "%)";
  } else {
    return "hsla(" + hue + ", " + sat + "%, " + light + "%, " + alpha + ")";
  }
};

export const text_stroke = (color, blur) =>
  "-1px -1px " + blur + " " + color + "," +
  "-1px  1px " + blur + " " + color + "," +
  " 1px -1px " + blur + " " + color + "," +
  " 1px  1px " + blur + " " + color;


export const floating = make_style({
  "position": ref.always("fixed"),
  "z-index": ref.always("2147483647") // 32-bit signed int
});

export const row = make_style({
  "display": ref.always("flex"),
  "flex-direction": ref.always("row"),
  "align-items": ref.always("center"), // TODO get rid of this ?
});

export const col = make_style({
  "display": ref.always("flex"),
  "flex-direction": ref.always("column"),
});

export const stretch = make_style({
  "flex-shrink": ref.always("1"),
  "flex-grow": ref.always("1"),
  "flex-basis": ref.always("0%"),
});


export const child = (f) =>
  make_tag("div", "div", null, f);

export const parent = (f) =>
  make_tag("div", "div", list.make(), f);

export const label = (f) =>
  make_tag("label", "label", list.make(), f);

// TODO is this correct ?
export const text = (f) =>
  make_tag("text", "div", null, f);

export const select = (f) =>
  make_tag("select", "select", list.make(), f);

export const optgroup = (f) =>
  make_tag("optgroup", "optgroup", list.make(), f);

export const option = (f) =>
  make_tag("option", "option", null, f);

export const image = (f) =>
  make_tag("img", "img", null, f);

export const iframe = (f) =>
  make_tag("iframe", "iframe", null, f);

export const button = (f) =>
  make_tag("button", "button", list.make(), f);

export const link = (f) =>
  make_tag("a", "a", null, f);

export const table = (f) =>
  make_tag("table", "table", list.make(), f);

export const table_row = (f) =>
  make_tag("tr", "tr", list.make(), f);

export const table_cell = (f) =>
  make_tag("td", "td", list.make(), f);

export const checkbox = (f) => {
  const e = make_tag("checkbox", "input", null, f);

  // TODO should this run before `f` ?
  e._dom["type"] = "checkbox";

  return e;
};

export const radio = (f) => {
  const e = make_tag("radio", "input", null, f);

  // TODO should this run before `f` ?
  e._dom["type"] = "radio";

  return e;
};

export const search = (f) => {
  const e = make_tag("search", "input", null, f);

  // TODO should this run before `f` ?
  // TODO a bit hacky, this should probably be configurable
  e._dom["autofocus"] = true;

  // TODO test these
  e._dom["type"] = "search";
  e._dom["incremental"] = true;
  e._dom["autocomplete"] = "off";
  e._dom["placeholder"] = "Search";
  e._dom["setAttribute"]("results", "");

  return e;
};

export const textbox = (f) => {
  const e = make_tag("textbox", "input", null, f);

  e._dom["type"] = "text";

  return e;
};


// TODO should we use `pointer-events: none` while scrolling, to make it smoother ?
const body = make("body", document["body"], list.make());

// TODO a tiny bit hacky
body._parent = make("html", document["body"]["parentNode"], null);

export const push_root = (x) => {
  _push(body, x);
};

// TODO does this trigger a relayout ?
export const set_title = (x) =>
  ref.listen(x, (x) => {
    if (x === null) {
      document["title"] = "";

    } else {
      document["title"] = x;
    }
  });
