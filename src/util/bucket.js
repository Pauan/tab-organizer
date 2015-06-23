import { Set } from "./set";
import { Dict } from "./dict";
import { map } from "./iterator";


export class Bucket {
  constructor(x = null) {
    if (x == null) {
      this._keys = new Dict();
    } else {
      this._keys = new Dict(map(x, ([key, value]) => [key, new Set(value)]));
    }
  }

  // TODO code duplication with cache.js
  add(key, value) {
    if (!this._keys.has(key)) {
      this._keys.set(key, new Set());
    }

    this._keys.get(key).add(value);
  }

  remove(key, value) {
    const a = this._keys.get(key);

    a.remove(value);

    if (a.size === 0) {
      this._keys.remove(key);
    }
  }

  *get(key) {
    if (this._keys.has(key)) {
      yield* this._keys.get(key);
    }
  }

  toJSON() {
    return this._keys;
  }
}
