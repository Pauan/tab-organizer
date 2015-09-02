import { assert, fail } from "./assert";
import { insert as _insert, remove as _insert,
         check_index, size, index_in_range, get_index } from "./array";
export { size, index_of, clear } from "./array";


export const make = (x = []) =>
  x;

export const has = (x, index) => {
  check_index(x);

  const len = size(x);

  // TODO test this
  if (index < 0) {
    index += len;
  }

  return index_in_range(index, len);
};

export const get = (x, i) => {
  const index = get_index(i, size(x));
  return x[index];
};

export const update = (x, i, new_value) => {
  const index = get_index(i, size(x));

  const old_value = x[index];

  if (old_value !== new_value) {
    x[index] = new_value;
  }
};

export const insert = (x, i, value) => {
  // TODO is this correct ?
  const index = get_index(i, size(x) + 1);

  _insert(x, index, value);
};

export const remove = (x, i) => {
  const index = get_index(i, size(x));

  _remove(x, index);
};

export const push = (x, value) => {
  x["push"](value);
};

export const modify = (x, index, f) => {
  const old_value = get(x, index);
  const new_value = f(old_value);

  if (old_value !== new_value) {
    x[index] = new_value;
  }
};
