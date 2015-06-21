// TODO code duplication with array.js
const empty = {};

export const get = (obj, key, def = empty) => {
  if (key in obj) {
    return obj[key];

  } else if (def === empty) {
    throw new Error("Key not found: " + key);

  } else {
    return def;
  }
};
