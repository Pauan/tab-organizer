/* @flow */
import { insert as _insert, remove as _remove,
         check_index, size as _size, index_in_range, get_index,
         index_of, clear, each, map, all, join,
         push, check_array, concat, find_first, find_last,
         contains } from "./array";

export { index_of, clear, each, map, all, join, push, concat,
         find_first, find_last, contains } from "./array";


export type List<A> = Array<A>;

export const make = <A>(...x: Array<A>): List<A> =>
  x;

export const has = <A>(x: List<A>, index: number): boolean => {
  check_index(index);

  const len = size(x);

  // TODO test this
  if (index < 0) {
    index += len;
  }

  return index_in_range(index, len);
};

export const size = <A>(x: List<A>): number => {
  check_array(x);
  return _size(x);
};

export const get = <A>(x: List<A>, i: number): A => {
  const index = get_index(i, size(x));
  return x[index];
};

export const update = <A>(x: List<A>, i: number, new_value: A): void => {
  const index = get_index(i, size(x));

  const old_value = x[index];

  if (old_value !== new_value) {
    x[index] = new_value;
  }
};

export const insert = <A>(x: List<A>, i: number, value: A): void => {
  // TODO is this correct ?
  const index = get_index(i, size(x) + 1);

  _insert(x, index, value);
};

export const remove = <A>(x: List<A>, i: number): void => {
  const index = get_index(i, size(x));

  _remove(x, index);
};

export const modify = <A>(x: List<A>, index: number, f: (_: A) => A): void => {
  const old_value = get(x, index);
  const new_value = f(old_value);

  if (old_value !== new_value) {
    x[index] = new_value;
  }
};
