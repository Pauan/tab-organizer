/* @flow */
import * as $list from "./list";
import { assert, crash } from "./assert";


const PENDING = 0;
const SUCCESS = 1;
const ERROR   = 2;

type State = typeof PENDING | typeof SUCCESS | typeof ERROR;

type Waiting<A, B> = {
  out: Async<B>,
  success: (_: Async<B>, _: A) => void,
  error: (_: Async<B>, _: A) => void
};

type Async<A> = {
  _state: State,
  _value: ?A,
  _waiting: $list.List<Waiting<A, *>>
};

export const make = <A>(): Async<A> => {
  return {
    _state: PENDING,
    _value: null,
    _waiting: $list.make()
  };
};

export const done = <A>(x: A): Async<A> => {
  return {
    _state: SUCCESS,
    _value: x,
    _waiting: $list.make()
  };
};


export const success = <A>(obj: Async<A>, value: A): void => {
  if (obj._state === PENDING) {
    obj._state = SUCCESS;
    obj._value = value;

    $list.each(obj._waiting, ({ out, success }) => {
      success(out, value);
    });

  } else {
    crash(new Error("async is not pending"));
  }
};

export const error = <A>(obj: Async<A>, value: A): void => {
  if (obj._state === PENDING) {
    obj._state = ERROR;
    obj._value = value;

    $list.each(obj._waiting, ({ out, error }) => {
      error(out, value);
    });

  } else {
    crash(new Error("async is not pending"));
  }
};

const _run = <A, B>(obj: Async<A>, out: Async<B>, success: (_: Async<B>, _: A) => void, error: (_: Async<B>, _: A) => void): void => {
  if (obj._state === PENDING) {
    $list.push(obj._waiting, { out, success, error });

  } else if (obj._state === SUCCESS) {
    if (obj._value != null) {
      success(out, obj._value);
    }

  } else if (obj._state === ERROR) {
    if (obj._value != null) {
      error(out, obj._value);
    }

  } else {
    crash();
  }
};

// TODO cancel the other asyncs when an error occurs ?
export const all = <A>(a: Array<Async<*>>, f: (..._: Array<*>) => Async<A>): Async<A> => {
  const out = make();

  let pending = $list.size(a);

  if (pending === 0) {
    // TODO this probably isn't tail-recursive
    _run(f(), out, success, error);

  } else {
    const values = new Array(pending);

    $list.each(a, (x, i) => {
      _run(x, out, (out, value) => {
        values[i] = value;

        --pending;

        if (pending === 0) {
          // TODO this probably isn't tail-recursive
          _run(f(...values), out, success, error);
        }
      }, error);
    });
  }

  return out;
};

// TODO why does this require * type ?
export const after = <A>(x: Async<A>, f: (_: A) => Async<*>): Async<*> => {
  const out = make();

  _run(x, out, (out, value) => {
    // TODO this probably isn't tail-recursive
    _run(f(value), out, success, error);
  }, error);

  return out;
};

const on_fail = (out, x) => {
  assert(out === null);
  crash(x);
};

const run_fail = (x) => {
  const err = new Error("async must return undefined");

  // TODO a bit hacky
  _run(x, (null : any), (out, x) => {
    assert(out === null);

    if (x !== undefined) {
      // TODO test this
      crash(err);
    }
  }, on_fail);
};

// TODO implement more efficiently ?
// TODO test this
export const run = <A>(x: Async<A>, f: (_: A) => void): void => {
  run_fail(after(x, (value) => done(f(value))));
};

// TODO implement more efficiently ?
// TODO test this
export const run_all = <A>(x: Array<Async<A>>, f: (..._: Array<A>) => void): void => {
  run_fail(all(x, (...value) => done(f(...value))));
};

const _ignore = <A>(_: A): Async<void> =>
  done(undefined);

export const ignore = <A>(x: Async<A>): Async<void> =>
  after(x, _ignore);

export const delay = (ms: number): Async<void> => {
  const out = make();

  setTimeout(() => {
    success(out, undefined);
  }, ms);

  return out;
};
