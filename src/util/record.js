export class Record {
  constructor(x) {
    this._dict = x;
  }

  get(key) {
    if (key in this._dict) {
      return this._dict[key];
    } else {
      throw new Error("Key not found: " + key);
    }
  }

  set(key, value) {
    if (key in this._dict) {
      this._dict[key] = value;
    } else {
      throw new Error("Key not found: " + key);
    }
  }

  toJSON() {
    return this._dict;
  }
}
