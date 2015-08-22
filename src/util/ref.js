import { Event } from "./event";
import { noop } from "./function";
//import { assert } from "../assert";


class Base {
  map(f) {
    return latest([this], f);
  }

  map_null(f) {
    return this.map((x) => (x === null ? null : f(x)));
  }

  each(f) {
    return this._listen(f, f);
  }

  on_change(f) {
    return this._listen(noop, f);
  }
}


export class Ref extends Base {
  constructor(value) {
    super();

    this._value = value;
    this._event = Event();
  }

  _listen(initial, change) {
    initial(this.get());
    return this._event.receive(change);
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

  _listen(initial, change) {
    initial(this._value);

    return {
      stop: noop
    };
  }
}


class First extends Base {
  constructor(parent) {
    super();

    this._parent = parent;
  }

  // TODO is this correct ?
  // TODO does this leak ?
  _listen(initial, change) {
    // TODO assert that `noop` is never called ?
    const x = this._parent._listen(initial, noop);

    x.stop();

    return {
      stop: noop
    };
  }
}


// TODO test this
class Throttle extends Base {
  constructor(parent, interval) {
    super();

    this._parent = parent;
    this._interval = interval;
  }

  _listen(initial, change) {
    let timer = null;
    let waiting = false;
    let old_value = null;
    let new_value = null;

    const done = () => {
      timer = null;
      waiting = false;

      if (old_value !== new_value) {
        old_value = new_value;
        change(old_value);
      }
    };

    const wait = (value) => {
      new_value = value;

      if (!waiting) {
        waiting = true;

        timer = setTimeout(done, this._interval);
      }
    };

    const x = this._parent._listen((value) => {
      old_value = value;
      new_value = value;

      wait(old_value);
      initial(old_value);
    }, wait);

    return {
      stop: () => {
        x.stop();

        if (timer !== null) {
          clearTimeout(timer);
        }
      }
    };
  }
}


class Latest extends Base {
  constructor(args, f) {
    super();

    this._args = args;
    this._fn = f;
  }

  _listen(initial, change) {
    const values = new Array(this._args["length"]);

    let old_value = null;
    let pending = values["length"];

    // TODO
    //assert(pending === this._args["length"]);


    const x = this._args["map"]((x, i) =>
      x._listen((value) => {
        values[i] = value;

        --pending;

        if (pending === 0) {
          // TODO
          //assert(old_value === null);
          old_value = this._fn(...values);
          initial(old_value);
        }

      }, (value) => {
        values[i] = value;

        // TODO
        //assert(pending === 0);

        const new_value = this._fn(...values);

        if (old_value !== new_value) {
          old_value = new_value;
          change(old_value);
        }
      }));


    // TODO
    //assert(pending === 0);

    return {
      stop: () => {
        // TODO test this
        x["forEach"]((x) => {
          x.stop();
        });
      }
    };
  }
}


export const always = (x) =>
  new Constant(x);

export const first = (x) =>
  new First(x);

export const throttle = (x, i) =>
  new Throttle(x, i);

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
