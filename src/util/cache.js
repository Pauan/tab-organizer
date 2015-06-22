export class Cache {
  constructor() {
    this._cache = {};
  }

  get(key, f) {
    if (!(key in this._cache)) {
      this._cache[key] = f();
    }

    return this._cache[key];
  }

  remove(key) {
    if (key in this._cache) {
      delete this._cache[key];
    } else {
      throw new Error("Key not found: " + key);
    }
  }
}
