import { each, iterator } from "../iterator";


// TODO maybe have it inherit from Map ?
export class Dict {
  constructor(x = null) {
    this._dict = new Map();
    this.size = 0;

    if (x != null) {
      each(x, ([key, value]) => {
        this.add(key, value);
      });
    }
  }

  has(key) {
    return this._dict["has"](key);
  }

  get(key) {
    if (this._dict["has"](key)) {
      return this._dict["get"](key);

    } else {
      throw new Error("Key not found: " + key);
    }
  }

  set(key, value) {
    if (this._dict["has"](key)) {
      this._dict["set"](key, value);
      // TODO this is probably unnecessary
      this.size = this._dict["size"];

    } else {
      throw new Error("Key not found: " + key);
    }
  }

  add(key, value) {
    if (this._dict["has"](key)) {
      throw new Error("Key already exists: " + key);

    } else {
      this._dict["set"](key, value);
      this.size = this._dict["size"];
    }
  }

  // TODO maybe this shouldn't throw an error ?
  remove(key) {
    if (this._dict["has"](key)) {
      this._dict["delete"](key);
      this.size = this._dict["size"];

    } else {
      throw new Error("Key not found: " + key);
    }
  }

  [Symbol["iterator"]]() {
    return iterator(this._dict);
  }
}
