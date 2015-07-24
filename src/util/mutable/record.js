import { each, entries, iterator } from "../iterator";
import { to_json } from "../immutable/json";
import { assert } from "../assert";


// TODO test this
export class Record {
  constructor(keys) {
    // TODO make a copy ?
    this._keys = keys;
  }

  has(key) {
    assert(typeof key === "string");

    return key in this._keys;
  }

  get(key) {
    assert(typeof key === "string");

    if (key in this._keys) {
      return this._keys[key];

    } else {
      throw new Error("Key not found: " + key);
    }
  }

  modify(key, f) {
    assert(typeof key === "string");

    const old_value = this.get(key);
    const new_value = f(old_value);

    if (old_value !== new_value) {
      this._keys[key] = new_value;
    }
  }

  insert(key, value) {
    assert(typeof key === "string");

    if (key in this._keys) {
      throw new Error("Key already exists: " + key);

    } else {
      this._keys[key] = value;
    }
  }

  remove(key) {
    assert(typeof key === "string");

    if (key in this._keys) {
      delete this._keys[key];

    } else {
      throw new Error("Key not found: " + key);
    }
  }

  update(key, value) {
    this.modify(key, (_) => value);
  }

  // TODO maybe change this to accept a thunk rather than a value ?
  default(key, value) {
    if (!this.has(key)) {
      this.insert(key, value);
    }
  }

  // TODO more efficient implementation of this
  assign(key, value) {
    if (this.has(key)) {
      this.update(key, value);
    } else {
      this.insert(key, value);
    }
  }

  to_json() {
    const out = {};

    // TODO is this inefficient ?
    for (let key in this._keys) {
      out[key] = to_json(this._keys[key]);
    }

    return out;
  }

  [Symbol["iterator"]]() {
    // TODO is this correct ?
    return iterator(entries(this._keys));
  }
}
