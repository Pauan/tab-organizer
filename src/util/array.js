/* @flow */
import * as $maybe from "./maybe";
import { assert, crash } from "./assert";


type Order = -1 | 0 | 1;

type Sorter<A> = (_: A, _: A) => Order;

// TODO is this correct ?
export const get_sorted = <A>(array: Array<A>, key: A, sort: Sorter<A>): { index: number, value: $maybe.Maybe<A> } => {
  let start = 0;
  let end   = size(array);

  while (start < end) {
    // TODO is this faster/slower than using Math.floor ?
    const pivot = (start + end) >> 1;

    const order = sort(key, array[pivot]);

    // TODO return the left-most index ?
    if (order === 0) {
      return {
        index: pivot,
        value: $maybe.some(array[pivot])
      };

    } else if (order < 0) {
      end = pivot;

    } else {
      start = pivot + 1;
    }
  }

  return {
    index: start,
    value: $maybe.none
  };
};

// TODO is this correct ?
export const is_sorted = <A>(list: Array<A>, index: number, len: number, sort: Sorter<A>): boolean => {
  const prev = index - 1;
  const next = index + 1;

  // TODO code duplication
  return (!index_in_range(prev, len) ||
          sort(list[index], list[prev]) > 0) &&
         (!index_in_range(next, len) ||
          sort(list[index], list[next]) < 0);
};

// TODO is this correct ?
export const is_all_sorted = <A>(list: Array<A>, sort: Sorter<A>): boolean => {
  const len = size(list) - 1;

  let index = 0;

  // TODO this might be incorrect
  while (index < len) {
    // TODO assert that `index + 1` is a valid index ?
    const x = list[index];
    const y = list[index + 1];

    if (sort(x, y) < 0) {
      ++index;

    } else {
      return false;
    }
  }

  return true;
};


export const contains = <A>(array: Array<A>, value: A): boolean => {
  check_array(array);

  return array.indexOf(value) !== -1;
};

export const index_of = <A>(array: Array<A>, value: A): number => {
  check_array(array);

  const index = array.indexOf(value);

  if (index === -1) {
    return crash(new Error("Could not find value: " + value));

  } else {
    return index;
  }
};

export const size = <A>(array: Array<A>): number =>
  array.length;

export const clear = <A>(array: Array<A>): void => {
  check_array(array);
  array.length = 0;
};


export const index_in_range = (index: number, len: number): boolean =>
  index >= 0 && index < len;

// TODO get rid of this ?
export const check_index = (index: number): void => {
  assert(typeof index === "number");
};

// TODO get rid of this ?
export const check_array = <A>(x: Array<A>): void => {
  assert(Array.isArray(x));
};

export const get_index = (index: number, len: number): number => {
  check_index(index);

  // TODO test this
  if (index < 0) {
    index += len;
  }

  if (index_in_range(index, len)) {
    return index;

  } else {
    return crash(new Error("Invalid index: " + index));
  }
};


export const insert = <A>(array: Array<A>, index: number, value: A): void => {
  // TODO test this
  // TODO maybe have the check for "unshift" before the check for "push" ?
  if (index === 0) {
    array.unshift(value);

  } else if (index === size(array)) {
    array.push(value);

  } else {
    array.splice(index, 0, value);
  }
};

export const remove = <A>(array: Array<A>, index: number): void => {
  // TODO test this
  if (index === 0) {
    array.shift();

  // TODO test this
  // TODO maybe have the check for "pop" before the check for "shift" ?
  } else if (index === size(array) - 1) {
    array.pop();

  } else {
    array.splice(index, 1);
  }
};

export const push = <A>(array: Array<A>, value: A): void => {
  check_array(array);

  array.push(value);
};

export const concat = <A>(a1: Array<A>, a2: Array<A>): Array<A> => {
  check_array(a1);
  check_array(a2);

  const len1 = size(a1);
  const len2 = size(a2);

  const out = new Array(len1 + len2);

  for (let i = 0; i < len1; ++i) {
    out[i] = a1[i];
  }

  for (let i = 0; i < len2; ++i) {
    out[i + len1] = a2[i];
  }

  return out;
};


export const each = <A>(array: Array<A>, f: (_: A, _: number) => void): void => {
  check_array(array);

  const len = size(array);

  for (let i = 0; i < len; ++i) {
    f(array[i], i);
  }
};

export const map = <A, B>(array: Array<A>, f: (_: A, _: number) => B): Array<B> => {
  check_array(array);

  const len = size(array);
  const out = new Array(len);

  for (let i = 0; i < len; ++i) {
    out[i] = f(array[i], i);
  }

  return out;
};

/*export const keep = (array, f) => {
  const out = [];

  for (let i = 0; i < size(array); ++i) {
    if (f(array[i], i)) {
      out["push"](array[i]);
    }
  }

  return out;
};*/

/*
// This is significantly faster than using Array.prototype.reverse
// http://jsperf.com/array-reverse-function
export const reverse = (array) => {
  let left  = 0;
  let right = size(array) - 1;
  while (left <= right) {
    const tmp = array[left];
    array[left] = array[right];
    array[right] = tmp;

    ++left;
    --right;
  }
};*/

export const find_first = <A>(array: Array<A>, f: (_: A, _: number) => boolean): $maybe.Maybe<A> => {
  check_array(array);

  const len = size(array);

  for (let i = 0; i < len; ++i) {
    if (f(array[i], i)) {
      return $maybe.some(array[i]);
    }
  }

  return $maybe.none;
};

export const find_last = <A>(array: Array<A>, f: (_: A, _: number) => boolean): $maybe.Maybe<A> => {
  check_array(array);

  for (let i = size(array) - 1; i >= 0; --i) {
    if (f(array[i], i)) {
      return $maybe.some(array[i]);
    }
  }

  return $maybe.none;
};

export const any = <A>(array: Array<A>, f: (_: A, _: number) => boolean): boolean =>
  $maybe.has(find_first(array, f));

export const all = <A>(array: Array<A>, f: (_: A, _: number) => boolean): boolean =>
  !any(array, (x, i) => !f(x, i));

/*export const zip = (...array) => {
  const out = [];

  let index = 0;

  for (;;) {
    const a = new Array(size(array));

    for (let i = 0; i < size(array); ++i) {
      const x = array[i];

      if (index < size(x)) {
        a[i] = x[index];

      } else {
        return out;
      }
    }

    out["push"](a);
    ++index;
  }
};*/

export const join = (x: Array<string>, s: string = ""): string => {
  check_array(x);
  return x.join(s);
};
