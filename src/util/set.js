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

  toJSON() {
    return Array["from"](this._set);
  }

  *[Symbol["iterator"]]() {
    yield* this._set;
  }
}

export { _Set as Set };
