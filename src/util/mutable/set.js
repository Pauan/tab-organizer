import { each, iterator } from "../iterator";


// TODO maybe have it inherit from Set ?
class _Set {
  constructor(x = null) {
    this._set = new Set();
    this.size = 0;

    if (x != null) {
      each(x, (value) => {
        this.add(value);
      });
    }
  }

  has(value) {
    return this._set["has"](value);
  }

  add(value) {
    if (this._set["has"](value)) {
      throw new Error("Value already exists in Set: " + value);

    } else {
      this._set["add"](value);
      this.size = this._set["size"];
    }
  }

  remove(value) {
    if (this._set["has"](value)) {
      this._set["delete"](value);
      this.size = this._set["size"];

    } else {
      throw new Error("Value does not exist in Set: " + value);
    }
  }

  [Symbol["iterator"]]() {
    return iterator(this._set);
  }
}

export { _Set as Set };
