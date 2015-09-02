import { Some, None } from "./maybe";
import { assert } from "./assert";


// TODO is this correct ?
export const get_sorted = (array, key, sort) => {
  let start = 0;
  let end   = array["length"];

  while (start < end) {
    // TODO is this faster/slower than using Math.floor ?
    const pivot = (start + end) >> 1;

    const order = sort(key, array[pivot]);

    // TODO return the left-most index ?
    if (order === 0) {
      return {
        index: pivot,
        value: Some(array[pivot])
      };

    } else if (order < 0) {
      end = pivot;

    } else {
      start = pivot + 1;
    }
  }

  return {
    index: start,
    value: None
  };
};

// TODO is this correct ?
export const is_sorted = (list, index, len, sort) => {
  const prev = index - 1;
  const next = index + 1;

  // TODO code duplication
  return (!index_in_range(prev, len) ||
          sort(list[prev], list[index]) < 0) &&
         (!index_in_range(next, len) ||
          sort(list[index], list[next]) > 0);
};

// TODO is this correct ?
export const is_all_sorted = (list, sort) => {
  const len = list["length"] - 1;

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


export const index_of = (array, value) => {
  const index = array["indexOf"](value);

  if (index === -1) {
    fail(new Error("Could not find value: " + value));

  } else {
    return index;
  }
};

export const size = (array) =>
  array["length"];

export const clear = (array) => {
  array["length"] = 0;
};


export const index_in_range = (index, len) =>
  index >= 0 && index < len;

export const check_index = (index) => {
  assert(typeof index === "number");
};

export const get_index = (index, len) => {
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


export const insert = (array, index, value) => {
  // TODO test this
  // TODO maybe have the check for "unshift" before the check for "push" ?
  if (index === 0) {
    array["unshift"](value);

  } else if (index === size(array)) {
    array["push"](value);

  } else {
    array["splice"](index, 0, value);
  }
};

export const remove = (array, index) => {
  // TODO test this
  if (index === 0) {
    array["shift"]();

  // TODO test this
  // TODO maybe have the check for "pop" before the check for "shift" ?
  } else if (index === size(array) - 1) {
    array["pop"]();

  } else {
    array["splice"](index, 1);
  }
};
