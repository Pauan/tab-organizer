import { push, discard, length } from "./array";
import { get } from "./object";

export class Bucket {
  constructor() {
    this._keys = {};
  }

  add(key, value) {
    if (this._keys[key] == null) {
      this._keys[key] = [value];

    } else {
      push(this._keys[key], value);
    }
  }

  remove(key, value) {
    const a = get(this._keys, key);

    discard(a, value);

    if (length(a) === 0) {
      delete this._keys[key];
    }
  }

  get(key) {
    return get(this._keys, key, []);
  }
}
