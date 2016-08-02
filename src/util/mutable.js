/* @flow */
import * as $list from "./list";
import * as $event from "./event";
import * as $running from "./running";
import * as $functions from "./functions";
import { assert, crash } from "./assert";


type Always<A> =
  { _type: 0, _value: A };

type Make<A> =
  { _type: 1, _value: A, _event: $event.Event<A> };

type Map<A, B> =
  { _type: 2, _parent: Mutable<A>, _fn: (_: A) => B };

type Latest<A, B> =
  { _type: 3, _args: Array<Mutable<A>>, _fn: (..._: Array<A>) => B };

type First<A> =
  { _type: 4, _parent: Mutable<A> };

export type Mutable<A>
  = Always<A>
  | Make<A>
  | Map<*, A>
  | Latest<*, A>
  | First<A>;


export const always = <A>(value: A): Always<A> => {
  return {
    _type: 0,
    _value: value
  };
};

export const make = <A>(value: A): Make<A> => {
  return {
    _type: 1,
    _value: value,
    _event: $event.make()
  };
};

export const map = <A, B>(parent: Mutable<A>, fn: (_: A) => B): Map<A, B> => {
  return {
    _type: 2,
    _parent: parent,
    _fn: fn
  };
};

export const latest = <A, B>(args: Array<Mutable<A>>, fn: (..._: Array<A>) => B): Latest<A, B> => {
  return {
    _type: 3,
    _args: args,
    _fn: fn
  };
};

export const first = <A>(parent: Mutable<A>): First<A> => {
  return {
    _type: 4,
    _parent: parent
  };
};


export const get = <A>(x: Make<A>): A => {
  if (x._type === 0 || x._type === 1) {
    return x._value;

  } else {
    return crash();
  }
};

export const set = <A>(x: Make<A>, value: A): void => {
  if (x._type === 1) {
    if (x._value !== value) {
      x._value = value;

      $event.send(x._event, value);
    }

  } else {
    crash();
  }
};

export const modify = <A>(x: Make<A>, f: (_: A) => A): void =>
  set(x, f(get(x)));


// TODO test this
const listen_map = <A>(x: Map<*, A>, f: (_: A) => void): $running.Runner => {
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
const listen_latest = <A, B>(ref: Latest<A, B>, f: (_: B) => void): $running.Runner => {
  const len    = $list.size(ref._args);
  const values = new Array(len);

  let old_value = null;
  let pending   = len;

  const stops = $list.map(ref._args, (x, i) =>
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
  return $running.make(() => {
    $list.each(stops, $running.stop);
  });
};

// TODO is this correct ?
// TODO does this leak ?
// TODO test this
const listen_first = <A>(x: First<A>, f: (_: A) => void): $running.Runner => {
  let first = true;

  // TODO assert that this function is not called twice ?
  const runner = listen(x._parent, (value) => {
    assert(first);

    first = false;

    f(value);
  });

  assert(!first);

  $running.stop(runner);

  return $running.noop();
};

export const listen = <A>(x: Mutable<A>, f: (_: A) => void): $running.Runner => {
  if (x._type === 0) {
    f(x._value);
    return $running.noop();

  } else if (x._type === 1) {
    f(x._value);
    return $event.on_receive(x._event, f);

  } else if (x._type === 2) {
    return listen_map(x, f);

  } else if (x._type === 3) {
    return listen_latest(x, f);

  } else if (x._type === 4) {
    return listen_first(x, f);

  } else {
    return crash();
  }
};

// TODO test this
export const on_change = <A>(x: Mutable<A>, f: (_: A) => void): $running.Runner => {
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


export const map_null = <A, B>(x: Mutable<?A>, f: (_: A) => B): Map<?A, ?B> =>
  map(x, (x) =>
    (x == null
      ? null
      : f(x)));

export const not = (x: Mutable<boolean>): Map<boolean, boolean> =>
  map(x, $functions.not);

export const and = (args: Array<Mutable<boolean>>): Latest<boolean, boolean> =>
  latest(args, $functions.and);

export const or = (args: Array<Mutable<boolean>>): Latest<boolean, boolean> =>
  latest(args, $functions.or);
