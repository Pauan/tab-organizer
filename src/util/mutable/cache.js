import { Dict } from "./dict";


export class Cache {
  constructor(x = null) {
    this._cache = new Dict(x);
  }

  get(key, f) {
    if (!this._cache.has(key)) {
      this._cache.set(key, f());
    }

    return this._cache.get(key);
  }

  remove(key) {
    this._cache.remove(key);
  }
}
