import * as list from "../../util/list";
import * as set from "../../util/set";
import { assert, fail } from "../../util/assert";
import { get_style_value, set_style_value } from "./style";


// TODO this isn't quite correct, but it will do for now
// TODO use batch_read ?
const wait_for_animation = (dom, a, done) => {
  let pending = list.size(a);

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
};


const start_animation = (_dom, a, done) => {
  wait_for_animation(_dom, a, () => {
    // TODO is this correct ?
    // TODO remove vendor prefix
    set_style_value(_dom["style"], "-webkit-animation", null);

    if (done != null) {
      done();
    }
  });

  // TODO remove vendor prefix
  set_style_value(_dom["style"], "-webkit-animation", list.join(a, ","));
};


// TODO test this
const get_animations = (dom, f) => {
  const out = list.make();

  if (dom._animations !== null) {
    set.each(dom._animations, ({ animation, info }) => {
      const type = f(info);

      // TODO a tiny bit hacky
      if (type) {
        if (type === "play-to") {
          list.push(out, animation._name + " " +
                         animation._duration + " " +
                         animation._easing +
                         " normal both");

        } else if (type === "play-from") {
          list.push(out, animation._name + " " +
                         animation._duration + " " +
                         animation._easing +
                         " reverse both");

        } else {
          fail();
        }
      }
    });
  }

  return out;
};


// TODO test this
export const animate = (dom, f, done = null) => {
  assert(dom._visible);
  assert(dom._parent !== null);

  const a = get_animations(dom, f);

  if (list.size(a)) {
    start_animation(dom._dom, a, done);

  } else {
    // TODO remove vendor prefix
    const animation = get_style_value(dom._dom["style"], "-webkit-animation");

    assert(animation === null);

    if (done != null) {
      done();
    }
  }
};
