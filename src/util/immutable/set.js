import { iterator, to_array } from "../iterator";
import { fail } from "../assert";
import { push, remove } from "./array";


// TODO inefficient, it's O(2n)
class ImmutableSet {
  constructor(x) {
    this._set = x;
    this.size = x["length"];
  }

  has(value) {
    return this._set["indexOf"](value) !== -1;
  }

  insert(value) {
    if (this._set["indexOf"](value) === -1) {
      return new ImmutableSet(push(this._set, value));

    } else {
      fail(new Error("Value already exists in Set: " + value));
    }
  }

  remove(value) {
    const index = this._set["indexOf"](value);

    if (index === -1) {
      fail(new Error("Value does not exist in Set: " + value));

    } else {
      return new ImmutableSet(remove(this._set, index));
    }
  }

  [Symbol["iterator"]]() {
    return iterator(this._set);
  }
}


export const Set = (x = null) => {
  if (x == null) {
    return new ImmutableSet([]);
  } else {
    return new ImmutableSet(to_array(x));
  }
};
