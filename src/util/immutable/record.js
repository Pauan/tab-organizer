import { iterator, entries } from "../iterator";
import { copy, insert, remove } from "./array";
import { to_json } from "./json";


const get_index = (array, key) => {
  let start = 0;
  let end   = array["length"];

  while (start < end) {
    // TODO is this faster/slower than using Math.floor ?
    const pivot = (start + end) >> 1;

    const other = array[pivot][0];

    if (key === other) {
      return {
        index: pivot,
        value: array[pivot]
      };

    } else if (key < other) {
      end = pivot;

    } else {
      start = pivot + 1;
    }
  }

  return {
    index: start,
    value: null
  };
};


export class ImmutableRecord {
  constructor(keys) {
    this._keys = keys;
    this.size = keys["length"];
  }

  has(key) {
    return get_index(this._keys, key).value !== null;
  }

  get(key) {
    const x = get_index(this._keys, key).value;

    if (x === null) {
      throw new Error("Key not found: " + key);

    } else {
      return x[1];
    }
  }

  update(key, f) {
    const x = get_index(this._keys, key);

    if (x.value === null) {
      throw new Error("Key not found: " + key);

    } else {
      const old_value = x.value[1];
      const new_value = f(old_value);

      if (old_value === new_value) {
        return this;

      } else {
        const keys = copy(this._keys);
        keys[x.index] = [key, new_value];
        return new ImmutableRecord(keys);
      }
    }
  }

  add(key, value) {
    const x = get_index(this._keys, key);

    if (x.value === null) {
      return new ImmutableRecord(insert(this._keys, x.index, [key, value]));

    } else {
      throw new Error("Key already exists: " + key);
    }
  }

  remove(key) {
    const x = get_index(this._keys, key);

    if (x.value === null) {
      throw new Error("Key not found: " + key);

    } else {
      return new ImmutableRecord(remove(this._keys, x.index));
    }
  }

  set(key, value) {
    return this.update(key, (_) => value);
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

const sort_keys = ([key1, value1], [key2, value2]) => {
  if (key1 === key2) {
    return 0;
  } else if (key1 < key2) {
    return -1;
  } else {
    return 1;
  }
};

export const Record = (x = null) => {
  if (x == null) {
    return new ImmutableRecord([]);
  } else {
    // TODO check for duplicates
    return new ImmutableRecord(Array["from"](x)["sort"](sort_keys));
  }
};
