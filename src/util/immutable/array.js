import { Some, None } from "./maybe";


export const copy = (array) => {
  const out = new Array(array["length"]);

  for (let i = 0; i < array["length"]; ++i) {
    out[i] = array[i];
  }

  return out;
};

export const insert = (array, index, value) => {
  const len = array["length"] + 1;

  const out = new Array(len);

  let i = 0;

  while (i < index) {
    out[i] = array[i];
    ++i;
  }

  out[i] = value;
  ++i;

  while (i < len) {
    out[i] = array[i - 1];
    ++i;
  }

  return out;
};

export const push = (array, value) => {
  const out = new Array(array["length"] + 1);

  let i = 0;

  while (i < array["length"]) {
    out[i] = array[i];
    ++i;
  }

  out[i] = value;

  return out;
};

export const remove = (array, index) => {
  const len = array["length"] - 1;

  const out = new Array(len);

  let i = 0;

  while (i < index) {
    out[i] = array[i];
    ++i;
  }

  while (i < len) {
    out[i] = array[i + 1];
    ++i;
  }

  return out;
};

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

// TODO what about duplicates ?
export const insert_sorted = (array, key, sort) =>
  insert(array, get_sorted(array, key, sort).index, key);

export const remove_sorted = (array, key, sort) => {
  const sorted = get_sorted(array, key, sort);
  assert(array[sorted.index] === sorted.value.get());
  return remove(array, sorted.index);
};
