import { each, indexed, iterator, to_array } from "../iterator";
import { Event, Stream, concat } from "../stream";
import { insert, remove, get_sorted } from "../immutable/array";
import { Some, None } from "../immutable/maybe";
import { fail } from "../assert";


export const uuid_list_initial = "80a3cdd8-ba5e-4ca4-9fde-9fee2271a882";
export const uuid_list_insert  = "fa4a6522-a031-4294-861e-d536b21b3b2d";
export const uuid_list_remove  = "df55a53e-ce78-40b4-b751-d6a356f311c2";
export const uuid_list_update  = "e51c3816-c859-47d0-a93c-e49c9e7e5be4";
export const uuid_list_clear   = "91e20a2a-55c1-4b7f-b2ca-d82d543f5a6c";


class Base {
  constructor(x = null) {
    if (x == null) {
      this._list = [];
    } else {
      this._list = to_array(x);
    }

    this.size = this._list["length"];


    const { input, output } = Event();

    this._input = input;

    // TODO hacky
    this.changes = concat([
      Stream((send, error, complete) => {
        each(indexed(this._list), ([i, value]) => {
          send({
            type: uuid_list_initial,
            index: i,
            value: value
          });
        });
      }),
      output
    ]);
  }

  map_changes(f) {
    return this.changes.map((x) => {
      switch (x.type) {
      case uuid_list_initial:
      case uuid_list_insert:
      case uuid_list_update:
        return {
          type: x.type,
          index: x.index,
          value: f(x.value)
        };

      case uuid_list_remove:
      case uuid_list_clear:
        return x;

      default:
        fail();
        break;
      }
    });
  }

  clear() {
    this._list["length"] = 0;
    this.size = 0;

    this._input.send({
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
export class List extends Base {
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
      throw new Error("Invalid index: " + index);
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

        this._input.send({
          type: uuid_list_update,
          index: index,
          value: new_value
        });
      }

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

    // TODO test this
    // TODO maybe have the check for "unshift" before the check for "push" ?
    if (index === 0) {
      this._list["unshift"](value);

    } else if (index === this.size) {
      this._list["push"](value);

    } else if (index > 0 && index < this.size) {
      this._list["splice"](index, 0, value);

    } else {
      throw new Error("Invalid index: " + index);
    }

    ++this.size;

    this._input.send({
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
      throw new Error("Invalid index: " + index);
    }

    --this.size;

    this._input.send({
      type: uuid_list_remove,
      index: index
    });
  }

  push(value) {
    const last = this.size;

    this._list["push"](value);
    ++this.size;

    this._input.send({
      type: uuid_list_insert,
      index: last,
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


// TODO test this
export class SortedList extends Base {
  constructor(sort) {
    super();

    this._sort = sort;
  }

  has(x) {
    const { value } = get_sorted(this._list, x, this._sort);

    return value.has();
  }

  insert(x) {
    const { index, value } = get_sorted(this._list, x, this._sort);

    assert(!value.has());

    // TODO hacky
    this._list["splice"](index, 0, x);
    ++this.size;

    // TODO code duplication
    this._input.send({
      type: uuid_list_insert,
      index: index,
      value: x
    });
  }

  remove(value) {
    const { index, value } = get_sorted(this._list, x, this._sort);

    assert(value.has());

    // TODO hacky
    this._list["splice"](index, 1);
    --this.size;

    // TODO code duplication
    this._input.send({
      type: uuid_list_remove,
      index: index
    });
  }

  // TODO can this be made any better ?
  is_sorted(x) {
    // TODO hacky
    const index = this._list["indexOf"](x);

    assert(index !== -1);
    assert(index_in_range(index, this.size));

    const prev = index - 1;
    const next = index + 1;

    // TODO code duplication
    return (!index_in_range(prev, this.size) ||
            this._sort(this._list[prev], x) <= 0) &&
           (!index_in_range(next, this.size) ||
            this._sort(x, this._list[next]) >= 0);
  }
}
