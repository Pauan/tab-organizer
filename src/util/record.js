/* @flow */
import * as $list from "./list";
import * as $maybe from "./maybe";
import { assert, crash } from "./assert";


// TODO remove this ?
const check_key = (key) => {
  if (!(typeof key === "string" || typeof key === "number")) {
    crash(new Error("Expected string or number but got: " + key));
  }
};


export type Record<A> = { [key: string]: A };


export const make = <A>(obj: Record<A> = {}): Record<A> =>
  obj;

// TODO is this inefficient ?
export const copy = <A>(obj: Record<A>): Record<A> => {
  const out = {};

  each(obj, (key, value) => {
    out[key] = value;
  });

  return out;
};

export const has = <A>(obj: Record<A>, key: string): boolean => {
  check_key(key);
  return key in obj;
};

export const get = <A>(obj: Record<A>, key: string): A => {
  check_key(key);

  if (key in obj) {
    return obj[key];

  } else {
    return crash(new Error("Key not found: " + key));
  }
};

export const get_maybe = <A>(obj: Record<A>, key: string): $maybe.Maybe<A> => {
  check_key(key);

  if (key in obj) {
    return $maybe.some(obj[key]);

  } else {
    return $maybe.none;
  }
};

export const get_default = <A>(obj: Record<A>, key: string, f: () => A): A => {
  check_key(key);

  if (key in obj) {
    return obj[key];

  } else {
    return f();
  }
};

// TODO test this
export const set_default = <A>(obj: Record<A>, key: string, f: () => A): A => {
  check_key(key);

  if (key in obj) {
    return obj[key];

  } else {
    return (obj[key] = f());
  }
};

export const insert = <A>(obj: Record<A>, key: string, value: A): void => {
  check_key(key);

  if (key in obj) {
    crash(new Error("Key already exists: " + key));

  } else {
    obj[key] = value;
  }
};

export const modify = <A>(obj: Record<A>, key: string, f: (_: A) => A): void => {
  const old_value = get(obj, key);
  const new_value = f(old_value);

  if (old_value !== new_value) {
    obj[key] = new_value;
  }
};

export const update = <A>(obj: Record<A>, key: string, new_value: A): void => {
  const old_value = get(obj, key);

  if (old_value !== new_value) {
    obj[key] = new_value;
  }
};

export const assign = <A>(obj: Record<A>, key: string, value: A): void => {
  check_key(key);

  obj[key] = value;
};

// TODO maybe change this to accept a thunk rather than a value ?
export const include = <A>(obj: Record<A>, key: string, value: A): void => {
  check_key(key);

  if (!(key in obj)) {
    obj[key] = value;
  }
};

export const exclude = <A>(obj: Record<A>, key: string): void => {
  check_key(key);

  if (key in obj) {
    delete obj[key];
  }
};

export const remove = <A>(obj: Record<A>, key: string): void => {
  check_key(key);

  if (key in obj) {
    delete obj[key];

  } else {
    crash(new Error("Key not found: " + key));
  }
};

export const each = <A>(obj: Record<A>, f: (_: string, _: A) => void): void => {
  $list.each(Object.keys(obj), (key) => {
    f(key, obj[key]);
  });
};
