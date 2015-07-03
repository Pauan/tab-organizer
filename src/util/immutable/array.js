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
