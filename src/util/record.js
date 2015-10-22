import * as list from "./list";
import * as maybe from "./maybe";
import { assert, crash } from "./assert";


const check_key = (key) => {
  if (!(typeof key === "string" || typeof key === "number")) {
    crash(new Error("Expected string or number but got: " + key));
  }
};


export const make = (obj = {}) =>
  obj;

// TODO is this inefficient ?
export const copy = (obj) => {
  const out = {};

  each(obj, (key, value) => {
    out[key] = value;
  });

  return out;
};

export const has = (obj, key) => {
  check_key(key);
  return key in obj;
};

export const get = (obj, key) => {
  check_key(key);

  if (key in obj) {
    return obj[key];

  } else {
    crash(new Error("Key not found: " + key));
  }
};

export const get_maybe = (obj, key) => {
  check_key(key);

  if (key in obj) {
    return maybe.some(obj[key]);

  } else {
    return maybe.none;
  }
};

export const get_default = (obj, key, f) => {
  check_key(key);

  if (key in obj) {
    return obj[key];

  } else {
    return f();
  }
};

// TODO test this
export const set_default = (obj, key, f) => {
  check_key(key);

  if (key in obj) {
    return obj[key];

  } else {
    return (obj[key] = f());
  }
};

export const insert = (obj, key, value) => {
  check_key(key);

  if (key in obj) {
    crash(new Error("Key already exists: " + key));

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
    crash(new Error("Key not found: " + key));
  }
};

export const each = (obj, f) => {
  list.each(Object["keys"](obj), (key) => {
    f(key, obj[key]);
  });
};
