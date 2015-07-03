import { Set } from "./set";
import { Dict } from "./dict";
import { map, iterator, empty } from "../iterator";


export class Bucket {
  constructor(x = null) {
    if (x == null) {
      this._keys = new Dict();
    } else {
      this._keys = new Dict(map(x, ([key, value]) => [key, new Set(value)]));
    }
  }

  has(key) {
    return this._keys.has(key);
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

  // TODO test this
  get(key) {
    if (this._keys.has(key)) {
      return iterator(this._keys.get(key));
    } else {
      return empty;
    }
  }
}
