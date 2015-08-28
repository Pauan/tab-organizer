import { iterator, entries, to_array } from "../iterator";
import { get_sorted, copy, insert, remove } from "../array";
import { to_json } from "../json";
import { assert, fail } from "../assert";


const sort_strings = (key1, key2) => {
  // TODO a bit inefficient ?
  assert(typeof key1 === "string");
  assert(typeof key2 === "string");

  if (key1 === key2) {
    return 0;
  } else if (key1 < key2) {
    return -1;
  } else {
    return 1;
  }
};

const sort_keys = ([key1], [key2]) =>
  sort_strings(key1, key2);

const sort_key = (key1, [key2]) =>
  sort_strings(key1, key2);


// TODO inefficient, it's O(n)
export class ImmutableRecord {
  constructor(keys) {
    this._keys = keys;
    this.size = keys["length"];
  }

  has(key) {
    return get_sorted(this._keys, key, sort_key).value.has();
  }

  get(key) {
    const x = get_sorted(this._keys, key, sort_key).value;

    if (x.has()) {
      return x.get()[1];

    } else {
      fail("Key not found: " + key);
    }
  }

  modify(key, f) {
    const x = get_sorted(this._keys, key, sort_key);

    if (x.value.has()) {
      const old_value = x.value.get()[1];
      const new_value = f(old_value);

      if (old_value === new_value) {
        return this;

      } else {
        const keys = copy(this._keys);
        keys[x.index] = [key, new_value];
        return new ImmutableRecord(keys);
      }

    } else {
      fail("Key not found: " + key);
    }
  }

  insert(key, value) {
    const x = get_sorted(this._keys, key, sort_key);

    if (x.value.has()) {
      fail("Key already exists: " + key);

    } else {
      return new ImmutableRecord(insert(this._keys, x.index, [key, value]));
    }
  }

  remove(key) {
    const x = get_sorted(this._keys, key, sort_key);

    if (x.value.has()) {
      return new ImmutableRecord(remove(this._keys, x.index));

    } else {
      fail("Key not found: " + key);
    }
  }

  update(key, value) {
    return this.modify(key, (_) => value);
  }

  // TODO maybe change this to accept a thunk rather than a value ?
  default(key, value) {
    if (this.has(key)) {
      return this;
    } else {
      return this.insert(key, value);
    }
  }

  // TODO more efficient implementation of this
  assign(key, value) {
    if (this.has(key)) {
      return this.update(key, value);
    } else {
      return this.insert(key, value);
    }
  }

  to_json() {
    const out = {};

    for (let i = 0; i < this._keys["length"]; ++i) {
      const [key, value] = this._keys[i];
      out[key] = to_json(value);
    }

    return out;
  }

  [Symbol["iterator"]]() {
    return iterator(this._keys);
  }
}

export const Record = (x = null) => {
  if (x == null) {
    return new ImmutableRecord([]);
  } else {
    // TODO check for duplicates
    return new ImmutableRecord(to_array(x)["sort"](sort_keys));
  }
};
