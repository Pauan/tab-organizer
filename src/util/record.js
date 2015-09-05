import { assert, fail } from "./assert";


const check_key = (key) => {
  assert(typeof key === "string" || typeof key === "number");
};


export const make = (obj = {}) =>
  obj;

export const has = (obj, key) => {
  check_key(key);
  return key in obj;
};

export const get = (obj, key) => {
  check_key(key);

  if (key in obj) {
    return obj[key];

  } else {
    fail(new Error("Key not found: " + key));
  }
};

export const insert = (obj, key, value) => {
  check_key(key);

  if (key in obj) {
    fail(new Error("Key already exists: " + key));

  } else {
    obj[key] = value;
  }
};

export const modify = (obj, key, f) => {
  const old_value = get(obj, key);
  const new_value = f(old_value);

  if (old_value !== new_value) {
    obj[key] = new_value;
  }
};

export const update = (obj, key, new_value) => {
  const old_value = get(obj, key);

  if (old_value !== new_value) {
    obj[key] = new_value;
  }
};

export const assign = (obj, key, value) => {
  check_key(key);

  obj[key] = value;
};

// TODO maybe change this to accept a thunk rather than a value ?
export const include = (obj, key, value) => {
  check_key(key);

  if (!(key in obj)) {
    obj[key] = value;
  }
};

export const exclude = (obj, key) => {
  check_key(key);

  if (key in obj) {
    delete obj[key];
  }
};

export const remove = (obj, key) => {
  check_key(key);

  if (key in obj) {
    delete obj[key];

  } else {
    fail(new Error("Key not found: " + key));
  }
};
