import { Set } from "../immutable/set";
import { each } from "../iterator";
import { Event } from "../event";


class Base {
  map(f) {
    return latest([this], f);
  }

  each(f) {
    f(this.get());

    return this._listen(f);
  }
}


class Latest extends Base {
  constructor(args, f) {
    super();

    this._args = args;
    this._fn = f;
  }

  get() {
    return this._fn(...this._args["map"]((x) => x.get()));
  }

  _listen(f) {
    const x = this._args["map"]((x) =>
      // This is needed in order to avoid errors with `Set#insert`
      x._listen(() => {
        f(this.get());
      }));

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
    super();

    this._value = value;
    this._event = Event();
  }

  _listen(f) {
    return this._event.receive(f);
  }

  get() {
    return this._value;
  }

  set(value) {
    if (this._value !== value) {
      this._value = value;
      this._event.send(value);
    }
  }

  modify(f) {
    this.set(f(this.get()));
  }
}


class Constant extends Base {
  constructor(value) {
    super();

    this._value = value;
  }

  // TODO is this correct ?
  _listen(f) {
    return {
      stop: () => {}
    };
  }

  get() {
    return this._value;
  }
}


export const always = (x) =>
  new Constant(x);

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
