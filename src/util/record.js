import { entries } from "./iterator";


export class Record {
  constructor(x) {
    this._dict = x;
  }

  has(key) {
    return key in this._dict;
  }

  get(key) {
    if (key in this._dict) {
      return this._dict[key];
    } else {
      throw new Error("Key not found: " + key);
    }
  }

  // TODO add in `set` method that doesn't throw an error ?
  // TODO rename this to `update` ?
  set(key, value) {
    if (key in this._dict) {
      this._dict[key] = value;
    } else {
      throw new Error("Key not found: " + key);
    }
  }

  add(key, value) {
    if (key in this._dict) {
      throw new Error("Key already exists: " + key);
    } else {
      this._dict[key] = value;
    }
  }

  remove(key) {
    if (key in this._dict) {
      delete this._dict[key];
    } else {
      throw new Error("Key not found: " + key);
    }
  }

  toJSON() {
    return this._dict;
  }

  [Symbol["iterator"]]() {
    return entries(this._dict);
  }
}
