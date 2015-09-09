import * as list from "./list";
import * as maybe from "./maybe";
import * as event from "./event";
import * as running from "./running";
import * as functions from "./functions";
import { assert, fail } from "./assert";


export const always = (value) => {
  return {
    _type: 0,
    _value: value
  };
};

export const make = (value) => {
  return {
    _type: 1,
    _value: value,
    _event: event.make()
  };
};

export const map = (parent, fn) => {
  return {
    _type: 2,
    _parent: parent,
    _fn: fn
  };
};

export const latest = (args, fn) => {
  return {
    _type: 3,
    _args: args,
    _fn: fn
  };
};

export const first = (parent) => {
  return {
    _type: 4,
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
  if (x._type === 1) {
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


// TODO test this
const listen_map = (x, f) => {
  let first = true;
  let old_value = null;

  return listen(x._parent, (value) => {
    const new_value = x._fn(value);

    if (first || old_value !== new_value) {
      first = false;

      old_value = new_value;
      f(old_value);
    }
  });
};

// TODO test this
const listen_latest = (ref, f) => {
  const len    = list.size(ref._args);
  const values = new Array(len);

  let old_value = null;
  let pending   = len;

  const stops = list.map(ref._args, (x, i) =>
    listen(x, (value) => {
      values[i] = value;

      if (pending === 0) {
        const new_value = ref._fn(...values);

        if (old_value !== new_value) {
          old_value = new_value;

          f(old_value);
        }

      } else {
        // TODO is this correct ?
        assert(i === len - pending);
        assert(old_value === null);

        --pending;

        if (pending === 0) {
          old_value = ref._fn(...values);

          f(old_value);
        }
      }
    }));

  assert(pending === 0);

  // TODO test this
  return running.make(() => {
    list.each(stops, running.stop);
  });
};

// TODO is this correct ?
// TODO does this leak ?
// TODO test this
const listen_first = (x, f) => {
  let first = true;

  // TODO assert that this function is not called twice ?
  const runner = listen(x._parent, (value) => {
    assert(first);

    first = false;

    running.stop(runner);
    f(value);
  });

  assert(!first);

  return running.noop;
};

export const listen = (x, f) => {
  if (x._type === 0) {
    f(x._value);
    return running.noop;

  } else if (x._type === 1) {
    f(x._value);
    return event.on_receive(x._event, f);

  } else if (x._type === 2) {
    return listen_map(x, f);

  } else if (x._type === 3) {
    return listen_latest(x, f);

  } else if (x._type === 4) {
    return listen_first(x, f);

  } else {
    fail();
  }
};

// TODO test this
export const on_change = (x, f) => {
  let first = true;

  const runner = listen(x, (x) => {
    if (first) {
      first = false;
    } else {
      f(x);
    }
  });

  assert(!first);

  return runner;
};


export const map_null = (x, f) =>
  map(x, (x) =>
    (x === null
      ? null
      : f(x)));

export const not = (x) =>
  map(x, functions.not);

export const and = (args) =>
  latest(args, functions.and);

export const or = (args) =>
  latest(args, functions.or);
