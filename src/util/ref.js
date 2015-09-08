import * as record from "./record";
import * as event from "./event";
import * as running from "./running";
import * as functions from "./functions";
import { assert, fail } from "./assert";


export const uuid_initial = "6ae5c093-0508-4274-80af-426db24ffcc9";
export const uuid_change  = "445eb523-f7a2-49d2-bd8d-cef5d98a19aa";


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
  if (x._type === 1) {
    if (x._value !== value) {
      x._value = value;

      event.send(x._event, record.make({
        "type": uuid_change,
        "value": value
      }));
    }

  } else {
    fail();
  }
};

export const modify = (x, f) => {
  set(x, f(get(x)));
};


const listen_latest = (ref, f) => {
  let old_value = null;
  let pending   = list.size(ref._args);

  const values = new Array(pending);

  const stops = list.map(ref._args, (x, i) =>
    listen(x, (info) => {
      const type = record.get(info, "type");

      switch (type) {
      case uuid_initial:
        assert(pending !== 0);
        assert(old_value === null);

        values[i] = record.get(info, "value");

        --pending;

        if (pending === 0) {
          old_value = ref._fn(...values);

          f(record.make({
            "type": type,
            "value": old_value
          }));
        }
        break;

      case uuid_change:
        assert(pending === 0);

        values[i] = record.get(info, "value");

        const new_value = ref._fn(...values);

        if (old_value !== new_value) {
          old_value = new_value;

          f(record.make({
            "type": type,
            "value": old_value
          }));
        }
        break;

      default:
        fail();
        break;
      }
    }));

  assert(pending === 0);

  // TODO test this
  return running.make(() => {
    list.each(stops, running.stop);
  });
};

export const listen = (x, f) => {
  if (x._type === 0) {
    f(record.make({
      "type": uuid_initial,
      "value": x._value
    }));

    return running.noop;


  } else if (x._type === 1) {
    f(record.make({
      "type": uuid_initial,
      "value": x._value
    }));

    return event.on_receive(x._event, f);


  } else if (x._type === 2) {
    return listen_latest(x, f);


  // TODO is this correct ?
  // TODO does this leak ?
  } else if (x._type === 3) {
    // TODO assert that this function is not called twice ?
    const runner = listen(x._parent, (x) => {
      if (record.get(x, "type") === uuid_initial) {
        running.stop(runner);
        f(x);

      } else {
        fail();
      }
    });

    return running.noop;


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


export const not = (x) =>
  map(x, functions.not);

export const and = (args) =>
  latest(args, functions.and);

export const or = (args) =>
  latest(args, functions.or);
