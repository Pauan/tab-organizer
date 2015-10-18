import * as list from "../../list";
import * as ref from "../../ref";
import * as set from "../../set";
import { get_style_value, set_style_value,
         insert_rule, set_rules } from "../style";
import { assert, crash } from "../../assert";


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
    crash(new Error("Animation took too long"));
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
      if (animation._duration !== null) {
        const type = f(info);

        // TODO a tiny bit hacky
        if (type) {
          if (type === "end-at") {
            list.push(out, animation._name + " " +
                           animation._duration + "ms " +
                           animation._easing +
                           " normal both");

          } else if (type === "start-at") {
            list.push(out, animation._name + " " +
                           animation._duration + "ms " +
                           animation._easing +
                           " reverse both");

          } else {
            crash();
          }
        }
      }
    });
  }

  return out;
};


let animation_id = 0;

export const make_animation = ({ style, duration, easing }) => {
  const name = "__animation_" + (++animation_id) + "__";

  const animation = {
    _type: 1,
    _name: name,
    _duration: null,
    _easing: null
  };


  // TODO remove webkit prefix ?
  const keyframe = insert_rule("@-webkit-keyframes " + name);

  keyframe["appendRule"]("100% {}");

  const to_style = keyframe["cssRules"][0]["style"];


  // TODO does this throw an error on un-animatable values ?
  set_rules(to_style, style);

  ref.listen(easing, (easing) => {
    animation._easing = easing;
  });

  ref.listen(duration, (duration) => {
    animation._duration = duration;
  });

  return animation;
};


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
