import { Set } from "../immutable/set";
import { each } from "../iterator";


class Base {
  map(f) {
    return new Latest([this], f);
  }

  each(f) {
    f(this.get());

    return this._listen(() => {
      f(this.get());
    });
  }
}


class Latest extends Base {
  constructor(args, f) {
    this._args = args;
    this._fn = f;
  }

  get() {
    return this._fn(...this._args["map"]((x) => x.get()));
  }

  _listen(f) {
    const x = this._args["map"]((x) => x._listen(f));

    return {
      stop: () => {
        x["forEach"]((x) => {
          x.stop();
        });
      }
    };
  }
}


export class Ref extends Base {
  constructor(value) {
    // TODO use mutable Set ?
    this._listeners = Set();
    this._value = value;
  }

  _listen(f) {
    this._listeners = this._listeners.insert(f);

    return {
      stop: () => {
        this._listeners = this._listeners.remove(f);
      }
    };
  }

  get() {
    return this._value;
  }

  update(value) {
    if (this._value !== value) {
      this._value = value;

      each(this._listeners, (f) => {
        f();
      });
    }
  }

  modify(f) {
    this.update(f(this.get()));
  }
}


export const latest = (args, f) =>
  new Latest(args, f);

export const not = (x) =>
  x.map((x) => !x);

// TODO is this correct ?
export const and = (args) =>
  latest(args, (...args) => {
    for (let i = 0; i < args["length"]; ++i) {
      if (!args[i]) {
        return false;
      }
    }

    return true;
  });

// TODO is this correct ?
export const or = (args) =>
  latest(args, (...args) => {
    for (let i = 0; i < args["length"]; ++i) {
      if (args[i]) {
        return true;
      }
    }

    return false;
  });
