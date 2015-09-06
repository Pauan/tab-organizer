import * as event from "./event";
import { noop, not as _not, and as _and, or as _or } from "./function";
import { assert, fail } from "./assert";


const stop = {
  stop: noop
};


export const make = (value) => {
  return {
    _type: 0,
    _value: value,
    _event: event.make()
  };
};

export const always = (value) => {
  return {
    _type: 1,
    _value: value
  };
};

export const latest = (args, fn) => {
  return {
    _type: 2,
    _args: args,
    _fn: fn
  };
};

export const first = (parent) => {
  return {
    _type: 3,
    _parent: parent
  };
};


export const get = (x) => {
  if (x._type === 0 || x._type === 1) {
    return x._value;

  } else {
    fail();
  }
};

export const set = (x, value) => {
  if (x._type === 0) {
    if (x._value !== value) {
      x._value = value;
      event.send(x._event, value);
    }

  } else {
    fail();
  }
};

export const modify = (x, f) => {
  set(x, f(get(x)));
};


const listen_latest = (x, initial, change) => {
  const values = new Array(x._args["length"]);

  let old_value = null;
  let pending = values["length"];

  assert(pending === x._args["length"]);

  const stops = [];

  for (let i = 0; i < x._args["length"]; ++i) {
    stops["push"](listen(x._args[i], (value) => {
      values[i] = value;

      --pending;

      if (pending === 0) {
        assert(old_value === null);
        old_value = x._fn(...values);
        initial(old_value);
      }

    }, (value) => {
      values[i] = value;

      assert(pending === 0);

      const new_value = x._fn(...values);

      if (old_value !== new_value) {
        old_value = new_value;
        change(old_value);
      }
    }));
  }

  assert(stops["length"] === x._args["length"]);
  assert(pending === 0);

  return {
    stop: () => {
      // TODO test this
      for (let i = 0; i < stops["length"]; ++i) {
        stops[i].stop();
      }
    }
  };
};

const listen = (x, initial, change) => {
  if (x._type === 0) {
    initial(x._value);
    return event.on_receive(x._event, change);


  } else if (x._type === 1) {
    initial(x._value);
    return stop;


  } else if (x._type === 2) {
    return listen_latest(x, initial, change);


  // TODO is this correct ?
  // TODO does this leak ?
  } else if (x._type === 3) {
    // TODO assert that `noop` is never called ?
    const stopper = listen(x._parent, initial, noop);

    stopper.stop();

    return stop;


  } else {
    fail();
  }
};


export const map = (x, f) =>
  latest([x], f);

export const map_null = (x, f) =>
  map(x, (x) =>
    (x === null
      ? null
      : f(x)));

export const each = (x, f) =>
  listen(x, f, f);

export const on_change = (x, f) =>
  listen(x, noop, f);


export const not = (x) =>
  map(x, _not);

export const and = (args) =>
  latest(args, _and);

export const or = (args) =>
  latest(args, _or);
