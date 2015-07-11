import { iterator, to_array } from "../iterator";
import { copy, insert, push, remove } from "./array";
import { to_json } from "./json";
import { assert } from "../assert";


class ImmutableList {
  constructor(x) {
    this._list = x;
    this.size = x["length"];
  }

  has(index) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    return index >= 0 && index < this.size;
  }

  get(index) {
    assert(typeof index === "number");

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
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size + 1;
    }

    if (index >= 0 && index <= this.size) {
      return new ImmutableList(insert(this._list, index, value));

    } else {
      throw new Error("Invalid index: " + index);
    }
  }

  update(index, f) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    if (index >= 0 && index < this.size) {
      const old_value = this._list[index];
      const new_value = f(old_value);

      if (old_value === new_value) {
        return this;

      } else {
        const list = copy(this._list);
        list[index] = new_value;
        return new ImmutableList(list);
      }

    } else {
      throw new Error("Invalid index: " + index);
    }
  }

  remove(index) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    if (index >= 0 && index < this.size) {
      return new ImmutableList(remove(this._list, index));

    } else {
      throw new Error("Invalid index: " + index);
    }
  }

  push(value) {
    return new ImmutableList(push(this._list, value));
  }

  index_of(value) {
    const index = this._list["indexOf"](value);

    if (index === -1) {
      throw new Error("Value was not found in List: " + value);

    } else {
      return index;
    }
  }

  // TODO test this
  concat(x) {
    // TODO write optimized array concat function ?
    return new ImmutableList(this._list["concat"](to_array(x)));
  }

  to_json() {
    const a = this._list;

    const out = new Array(a["length"]);

    for (let i = 0; i < a["length"]; ++i) {
      out[i] = to_json(a[i]);
    }

    return out;
  }

  [Symbol["iterator"]]() {
    return iterator(this._list);
  }
}


export const List = (x = null) => {
  if (x == null) {
    return new ImmutableList([]);
  } else {
    return new ImmutableList(to_array(x));
  }
};
