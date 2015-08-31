import { assert, fail } from "./assert";


const index_in_range = (index, len) =>
  index >= 0 && index < len;

const check_index = (index) => {
  assert(typeof index === "number");
};

const get_index = (index, len) => {
  check_index(index);

  // TODO test this
  if (index < 0) {
    index += len;
  }

  if (index_in_range(index, len)) {
    return index;

  } else {
    fail(new Error("Invalid index: " + index));
  }
};


const _insert = (array, index, value) => {
  // TODO test this
  // TODO maybe have the check for "unshift" before the check for "push" ?
  if (index === 0) {
    array["unshift"](value);

  } else if (index === length(array)) {
    array["push"](value);

  } else {
    array["splice"](index, 0, value);
  }
};

const _remove = (array, index) => {
  // TODO test this
  if (index === 0) {
    array["shift"]();

  // TODO test this
  // TODO maybe have the check for "pop" before the check for "shift" ?
  } else if (index === length(array) - 1) {
    array["pop"]();

  } else {
    array["splice"](index, 1);
  }
};


export const length = (array) =>
  array["length"];

export const clear = (array) => {
  array["length"] = 0;
};

export const insert = (array, index, value) => {
  check_index(index);
};

export const has = (array, index) => {
  check_index(index);

  const len = length(array);

  // TODO test this
  if (index < 0) {
    index += len;
  }

  return index_in_range(index, len);
};

export const get = (array, i) => {
  const index = get_index(i, length(array));
  return array[index];
};

export const index_of = (array, value) => {
  const index = array["indexOf"](value);

  if (index === -1) {
    fail(new Error("Could not find value: " + value));

  } else {
    return index;
  }
};

export const update = (array, i, new_value) => {
  const index = get_index(i, length(array));

  const old_value = array[index];

  if (old_value !== new_value) {
    array[index] = new_value;
  }
};

export const insert = (array, i, value) => {
  // TODO is this correct ?
  const index = get_index(i, length(array) + 1);

  _insert(array, index, value);
};

export const remove = (array, i) => {
  const index = get_index(i, length(array));

  _remove(array, index);
};

export const push = (array, value) => {
  array["push"](value);
};

export const modify = (array, index, f) => {
  const old_value = get(array, index);
  const new_value = f(old_value);

  if (old_value !== new_value) {
    array[index] = new_value;
  }
};
