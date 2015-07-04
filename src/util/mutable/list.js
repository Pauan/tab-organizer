import { iterator, to_array } from "../iterator";


// TODO maybe have it inherit from Array ?
export class List {
  constructor(x = null) {
    if (x == null) {
      this._list = [];
    } else {
      this._list = to_array(x);
    }

    this.size = this._list["length"];
  }

  has(index) {
    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    return index >= 0 && index < this.size;
  }

  get(index) {
    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    if (index >= 0 && index < this.size) {
      return this._list[index];

    } else {
      throw new Error("Invalid index: " + index);
    }
  }

  insert(index, value) {
    // TODO test this
    if (index < 0) {
      index += this.size + 1;
    }

    // TODO test this
    // TODO maybe have the check for "unshift" before the check for "push" ?
    if (index === 0) {
      this._list["unshift"](value);
      ++this.size;

    } else if (index === this.size) {
      this._list["push"](value);
      ++this.size;

    } else if (index > 0 && index < this.size) {
      this._list["splice"](index, 0, value);
      ++this.size;

    } else {
      throw new Error("Invalid index: " + index);
    }
  }

  remove(index) {
    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    // TODO test this
    if (index === 0) {
      this._list["shift"]();
      --this.size;

    // TODO test this
    // TODO maybe have the check for "pop" before the check for "shift" ?
  } else if (index === this.size - 1) {
      this._list["pop"]();
      --this.size;

    } else if (index > 0 && index < this.size) {
      this._list["splice"](index, 1);
      --this.size;

    } else {
      throw new Error("Invalid index: " + index);
    }
  }

  clear() {
    this._list["length"] = 0;
  }

  push(value) {
    this._list["push"](value);
    ++this.size;
  }

  index_of(value) {
    const index = this._list["indexOf"](value);

    if (index === -1) {
      throw new Error("Value was not found in List: " + value);

    } else {
      return index;
    }
  }

  [Symbol["iterator"]]() {
    return iterator(this._list);
  }
}
