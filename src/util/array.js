// TODO code duplication with object.js
const empty = {};

export const push = (a, x) => {
  a["push"](x);
};

export const length = (a) => a["length"];

export const indexOf = (a, x, def = empty) => {
  const index = a["indexOf"](x);

  if (index === -1) {
    if (def === empty) {
      throw new Error("Object " + x + " was not found in array");

    } else {
      return def;
    }

  } else {
    return index;
  }
};

export const nth = (a, i) => {
  const len = length(a);

  // TODO test this
  if (i < 0) {
    i += len;
  }

  if (i >= 0 && i < len) {
    return a[i];
  } else {
    throw new Error("Invalid index: " + i);
  }
};

export const nth_remove = (a, i) => {
  const len = length(a);

  // TODO test this
  if (i < 0) {
    i += len;
  }

  // TODO test this
  if (i === 0) {
    a["shift"]();

  // TODO test this
  // TODO maybe have the check for "pop" before the check for "shift" ?
  } else if (i === len - 1) {
    a["pop"]();

  } else if (i >= 0 && i < len) {
    a["splice"](i, 1);

  } else {
    throw new Error("Invalid index: " + i);
  }
};

export const discard = (a, x) => {
  nth_remove(a, indexOf(a, x));
};
