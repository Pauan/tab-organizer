import { map, iterator, to_array, indexed } from "../iterator";
import { insert, remove, get_sorted } from "../immutable/array";
import { Set } from "../immutable/set";
import { Some, None } from "../immutable/maybe";
import { assert, fail } from "../assert";
import { Event } from "../event";
import { to_json } from "../immutable/json";


export const uuid_list_insert = "fa4a6522-a031-4294-861e-d536b21b3b2d";
export const uuid_list_remove = "df55a53e-ce78-40b4-b751-d6a356f311c2";
export const uuid_list_update = "e51c3816-c859-47d0-a93c-e49c9e7e5be4";
export const uuid_list_clear  = "91e20a2a-55c1-4b7f-b2ca-d82d543f5a6c";


class Base {
  map(f) {
    return new Map(this, f);
  }

  on_change(f) {
    return this._listen(f);
  }
}


class Map extends Base {
  constructor(parent, fn) {
    super();

    this._parent = parent;
    this._fn = fn;
  }

/*
  // TODO a bit hacky
  get size() {
    return this._parent.size;
  }*/

  _listen(f) {
    return this._parent._listen((x) => {
      switch (x.type) {
      case uuid_list_insert:
      case uuid_list_update:
        f({
          type: x.type,
          index: x.index,
          // TODO should this pass in the index to the function ?
          value: this._fn(x.value, x.index)
        });
        break;

      case uuid_list_remove:
      case uuid_list_clear:
        f(x);
        break;

      default:
        fail();
        break;
      }
    });
  }

  [Symbol["iterator"]]() {
    // TODO is this correct ?
    return iterator(map(indexed(this._parent), ([i, x]) => this._fn(x, i)));
  }
}


class ListBase extends Base {
  constructor(x = null) {
    super();

    if (x == null) {
      this._list = [];
    } else {
      this._list = to_array(x);
    }

    // TODO use a getter to prevent assignment to the `size` ?
    this.size = this._list["length"];

    this._event = Event();
  }

  _listen(f) {
    return this._event.receive(f);
  }

  clear() {
    this._list["length"] = 0;
    this.size = 0;

    this._event.send({
      type: uuid_list_clear
    });
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

  get(index) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    if (index_in_range(index, this.size)) {
      return this._list[index];

    } else {
      fail("Invalid index: " + index);
    }
  }

  modify(index, f) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    if (index_in_range(index, this.size)) {
      const old_value = this._list[index];
      const new_value = f(old_value);

      if (old_value !== new_value) {
        this._list[index] = new_value;

        this._event.send({
          type: uuid_list_update,
          index: index,
          value: new_value
        });
      }

    } else {
      fail("Invalid index: " + index);
    }
  }

  insert(index, value) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size + 1;
    }

    // TODO test this
    // TODO maybe have the check for "unshift" before the check for "push" ?
    if (index === 0) {
      this._list["unshift"](value);

    } else if (index === this.size) {
      this._list["push"](value);

    } else if (index > 0 && index < this.size) {
      this._list["splice"](index, 0, value);

    } else {
      fail("Invalid index: " + index);
    }

    ++this.size;

    this._event.send({
      type: uuid_list_insert,
      index: index,
      value: value
    });
  }

  remove(index) {
    assert(typeof index === "number");

    // TODO test this
    if (index < 0) {
      index += this.size;
    }

    // TODO test this
    if (index === 0) {
      this._list["shift"]();

    // TODO test this
    // TODO maybe have the check for "pop" before the check for "shift" ?
    } else if (index === this.size - 1) {
      this._list["pop"]();

    } else if (index > 0 && index < this.size) {
      this._list["splice"](index, 1);

    } else {
      fail("Invalid index: " + index);
    }

    --this.size;

    this._event.send({
      type: uuid_list_remove,
      index: index
    });
  }

  push(value) {
    // TODO is this correct ?
    const index = this._list["push"](value) - 1;

    ++this.size;

    this._event.send({
      type: uuid_list_insert,
      index: index,
      value: value
    });
  }

  update(index, value) {
    this.modify(index, (_) => value);
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


/*const is_sorted = (self, x, index) => {
  assert(index !== -1);
  assert(index_in_range(index, self.size));

  const prev = index - 1;
  const next = index + 1;

  // TODO code duplication
  return (!index_in_range(prev, self.size) ||
          self._sort(self._list[prev], x) <= 0) &&
         (!index_in_range(next, self.size) ||
          self._sort(x, self._list[next]) >= 0);
};*/

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

  _remove(index) {
    // TODO hacky
    this._list["splice"](index, 1);
    --this.size;

    this._event.send({
      type: uuid_list_remove,
      index: index
    });
  }

  insert(x) {
    const { index, value } = get_sorted(this._list, x, this._sort);

    assert(!value.has());

    // TODO hacky
    this._list["splice"](index, 0, x);
    ++this.size;

    this._event.send({
      type: uuid_list_insert,
      index: index,
      value: x
    });
  }

  remove(x) {
    // TODO can this be made more efficient ?
    const index = this._list["indexOf"](x);

    assert(index !== -1);

    this._remove(index);
  }

  // TODO test this
  // TODO use cycle sort or something ?
  change_sort(sort) {
    this._sort = sort;

    const changes = [];

    let index = 0;

    // TODO this might be incorrect
    while (index < this._list["length"] - 1) {
      // TODO assert that `index + 1` is a valid index ?
      const x = this._list[index];
      const y = this._list[index + 1];

      if (this._sort(x, y) <= 0) {
        ++index;

      } else {
        changes["push"](y);

        this._remove(index + 1);
      }
    }

    changes["forEach"]((x) => {
      this.insert(x);
    });
  }

/*
  // TODO can this be made any better ?
  is_sorted(x) {
    // TODO hacky
    const index = this._list["indexOf"](x);

    return is_sorted(this, x, index);
  }*/
}
