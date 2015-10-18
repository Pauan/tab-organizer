import * as record from "../../record";
import * as list from "../../list";
import * as ref from "../../ref";
import * as set from "../../set";
import * as string from "../../string";
import { assert, crash } from "../../assert";


const TweenLite = window["TweenLite"];
const Power1    = window["Power1"];


const animation_fail = () => {
  crash(new Error("Animation took too long"));
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
            list.push(out, { animation, type });

          } else if (type === "start-at") {
            list.push(out, { animation, type });

          } else {
            crash();
          }
        }
      }
    });
  }

  return out;
};

const tween_lite = (method, _dom, animation, done) => {
  assert(animation._easing !== null);
  assert(animation._duration !== null);

  const timer = setTimeout(animation_fail, 10000);

  TweenLite[method](_dom, animation._duration / 1000, {
    "immediateRender": false,
    "autoCSS": false,
    "lazy": true,
    "ease": animation._easing,
    "css": animation._style,
    "onComplete": () => {
      clearTimeout(timer);
      done();
    }
  });
};

const start_animation = (_dom, animation, type, done) => {
  if (type === "end-at") {
    tween_lite("to", _dom, animation, done);

  } else if (type === "start-at") {
    tween_lite("from", _dom, animation, done);

  } else {
    crash();
  }
};


const re_property = /([a-zA-Z])\-([a-zA-Z])/g;

const uppercase = (_, x, y) =>
  x + string.uppercase(y);

const convert_property = (s) =>
  string.replace(s, re_property, uppercase);


const easings = record.make({
  "ease-out":    Power1["easeOut"],
  "ease-in-out": Power1["easeInOut"],
  "ease-in":     Power1["easeIn"]
});

export const make_animation = ({ style, duration, easing }) => {
  const _style = {};
  const _props = list.make();


  const animation = {
    _type: 1,
    _style: _style,
    _duration: null,
    _easing: null
  };


  record.each(style, (key, value) => {
    const prop = convert_property(key);

    list.push(_props, prop);

    ref.listen(value, (value) => {
      if (value === null) {
        // TODO is this correct ?
        delete _style[prop];

      } else {
        _style[prop] = value;
      }
    });
  });

  _style["clearProps"] = list.join(_props, ",");


  ref.listen(easing, (easing) => {
    animation._easing = record.get(easings, easing);
  });

  ref.listen(duration, (duration) => {
    animation._duration = duration;
  });


  return animation;
};


export const animate = (dom, f, _done = null) => {
  assert(dom._visible);
  assert(dom._parent !== null);

  const a = get_animations(dom, f);

  let pending = list.size(a);

  if (pending !== 0) {
    const done = () => {
      --pending;

      if (pending === 0 && _done != null) {
        _done();
      }
    };

    list.each(a, ({ animation, type }) => {
      start_animation(dom._dom, animation, type, done);
    });

  } else if (_done != null) {
    _done();
  }
};
