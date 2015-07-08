import { Event } from "./event";
import { map, each, to_array } from "./iterator";


export class Ref {
  constructor(value) {
    this._destroyed = false;
    this._value = value;
    this.on_change = new Event();
    this.on_destroy = new Event();
  }

  get value() {
    if (this._destroyed) {
      throw new Error("Cannot get value, Ref is destroyed");
    }

    return this._value;
  }

  set value(value) {
    if (this._destroyed) {
      throw new Error("Cannot set value, Ref is destroyed");
    }

    const old = this._value;

    if (value !== old) {
      this._value = value;

      // TODO batch changes ?
      this.on_change.send({
        old: old,
        new: value
      });
    }
  }

  destroy() {
    const on_destroy = this.on_destroy;

    this._destroyed = true;
    this._value = null;
    this.on_change = null;
    this.on_destroy = null;

    on_destroy.send(undefined);
  }

  /*modify(f) {
    this.value = f(this.value);
  }*/
}


const values = (f, a) =>
  f(...map(a, (x) => x.value));

// TODO test this
const unlisten = (a) => {
  each(a, ({ on_change, on_destroy }) => {
    on_change.unlisten();
    on_destroy.unlisten();
  });
};

export const observe = (f, ...a) => {
  const ref = new Ref(values(f, a));

  // This uses `to_array` to force the iterator
  const listeners = to_array(map(a, (x) => {
    return {
      on_change: x.on_change.listen(() => {
        ref.value = values(f, a);
      }),

      on_destroy: x.on_destroy.listen(() => {
        // TODO is this correct ?
        unlisten(listeners);
        ref.destroy();
      })
    };
  }));

  ref.on_destroy.listen(() => {
    unlisten(listeners);
  });

  return ref;
};
