import { iterator, to_array } from "../iterator";
import { get_sorted } from "../immutable/array";
import { Some, None } from "../maybe";
import { assert, fail } from "../assert";
import { to_json } from "../immutable/json";


class ListBase {
  constructor(x = null) {
    if (x == null) {
      this._list = [];
    } else {
      this._list = to_array(x);
    }

    // TODO use a getter to prevent assignment to the `size` ?
    this.size = this._list["length"];
  }

  _clear() {
    this._list["length"] = 0;
    this.size = 0;
  }

  _insert(index, value) {
    // TODO test this
    // TODO maybe have the check for "unshift" before the check for "push" ?
    if (index === 0) {
      this._list["unshift"](value);

    } else if (index === this.size) {
      this._list["push"](value);

    } else {
      this._list["splice"](index, 0, value);
    }

    ++this.size;
  }

  _remove(index) {
    // TODO test this
    if (index === 0) {
      this._list["shift"]();

    // TODO test this
    // TODO maybe have the check for "pop" before the check for "shift" ?
    } else if (index === this.size - 1) {
      this._list["pop"]();

    } else {
      this._list["splice"](index, 1);
    }

    --this.size;
  }

  _update(index, value) {
    this._list[index] = value;
  }

  clear() {
    this._clear();
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


const index_in_range = (index, len) =>
  index >= 0 && index < len;

const get_index = (index, len) => {
  assert(typeof index === "number");

  // TODO test this
  if (index < 0) {
    index += len;
  }

  if (index_in_range(index, len)) {
    return index;

  } else {
    fail(new Error("Invalid index: " + index));
  }
};

// TODO test this
export class List extends ListBase {
  has(index) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    return index_in_range(index, this.size);
  }

  get(i) {
    const index = get_index(i, this.size);

    return this._list[index];
  }

  update(i, new_value) {
    const index = get_index(i, this.size);

    const old_value = this._list[index];

    if (old_value !== new_value) {
      this._update(index, new_value);
    }
  }

  insert(i, value) {
    // TODO is this correct ?
    const index = get_index(i, this.size + 1);

    this._insert(index, value);
  }

  remove(i) {
    const index = get_index(i, this.size);

    this._remove(index);
  }

  push(value) {
    this._insert(this.size, value);
  }

  modify(index, f) {
    const old_value = this.get(index);
    const new_value = f(old_value);

    if (old_value !== new_value) {
      this._update(index, new_value);
    }
  }

  index_of(value) {
    const index = this._list["indexOf"](value);

    if (index === -1) {
      return None;

    } else {
      return Some(index);
    }
  }
}


// TODO is this correct ?
const is_sorted = (list, index, len, sort) => {
  const prev = index - 1;
  const next = index + 1;

  // TODO code duplication
  return (!index_in_range(prev, len) ||
          sort(list[prev], list[index]) < 0) &&
         (!index_in_range(next, len) ||
          sort(list[index], list[next]) > 0);
};

// TODO test this
export class SortedList extends ListBase {
  constructor(sort) {
    super();

    this._sort = sort;
  }

  has(x) {
    const { value } = get_sorted(this._list, x, this._sort);

    return value.has();
  }

  // TODO test this
  _is_sorted() {
    const len = this._list["length"] - 1;

    let index = 0;

    // TODO this might be incorrect
    while (index < len) {
      // TODO assert that `index + 1` is a valid index ?
      const x = this._list[index];
      const y = this._list[index + 1];

      if (this._sort(x, y) < 0) {
        ++index;

      } else {
        return false;
      }
    }

    return true;
  }

  insert(x) {
    const { index, value } = get_sorted(this._list, x, this._sort);

    assert(!value.has());

    this._insert(index, x);

    // TODO inefficient
    assert(this._is_sorted());
  }

  remove(x) {
    const { index, value } = get_sorted(this._list, x, this._sort);

    assert(value.get() === x);

    this._remove(index);

    // TODO inefficient
    assert(this._is_sorted());
  }

  update(x) {
    const index = this._list["indexOf"](x);
    const len   = this._list["length"];

    assert(index !== -1);
    assert(index_in_range(index, len));

    // TODO is this correct ?
    if (!is_sorted(this._list, index, len, this._sort)) {
      this.remove(x); // TODO this probably needs to use indexOf
      this.insert(x);
    }

    // TODO inefficient
    assert(this._is_sorted());
  }
}
