import * as list from "./list";
import * as record from "./record";
import * as event from "./event";
import * as maybe from "./maybe";
import { insert as _insert, remove as _remove,
         index_of, size, index_in_range, get_sorted,
         is_sorted, clear as _clear } from "./array";
import { map, iterator } from "./iterator";
import { assert, fail } from "./assert";


export const uuid_initial = "9fea84a4-c36f-4ecf-a1d2-9bbcf778385b";
export const uuid_insert  = "fa4a6522-a031-4294-861e-d536b21b3b2d";
export const uuid_remove  = "df55a53e-ce78-40b4-b751-d6a356f311c2";
export const uuid_update  = "e51c3816-c859-47d0-a93c-e49c9e7e5be4";
export const uuid_clear   = "91e20a2a-55c1-4b7f-b2ca-d82d543f5a6c";


export const make = () => {
  return {
    _type: 0,
    _list: list.make(),
    _events: event.make()
  };
};

export const sorted_make = (sort) => {
  return {
    _type: 1,
    _list: [],
    _events: event.make(),
    _sort: sort
  };
};

export const map = (parent, fn) => {
  return {
    _type: 2,
    _parent: parent,
    _fn: fn
  };
};


export const insert = (stream, index, x) => {
  if (stream._type === 0) {
    list.insert(stream._list, index, x);
    event_insert(stream, index, x);

  } else {
    fail();
  }
};

export const push = (stream, x) => {
  if (stream._type === 0) {
    list.push(stream._list, x);
    // TODO is this correct ?
    event_insert(stream, size(stream._list) - 1, x);

  } else {
    fail();
  }
};

export const remove = (stream, index) => {
  if (stream._type === 0) {
    list.remove(stream._list, index);
    event_remove(stream, index);

  } else {
    fail();
  }
};


export const sorted_has = (stream, x) => {
  if (stream._type === 1) {
    const { value } = get_sorted(stream._list, x, stream._sort);
    return maybe.has(value);

  } else {
    fail();
  }
};

export const sorted_insert = (stream, x) => {
  if (stream._type === 1) {
    const { index, value } = get_sorted(stream._list, x, stream._sort);

    assert(!maybe.has(value));

    _insert(stream._list, index, x);
    event_insert(stream, index, x);

    // TODO inefficient
    assert(is_all_sorted(stream._list, stream._sort));

  } else {
    fail();
  }
};

export const sorted_remove = (stream, x) => {
  if (stream._type === 1) {
    const { index, value } = get_sorted(stream._list, x, stream._sort);

    assert(maybe.get(value) === x);

    _remove(stream._list, index);
    event_remove(stream, index);

    // TODO inefficient
    assert(is_all_sorted(stream._list, stream._sort));

  } else {
    fail();
  }
};

export const sorted_update = (stream, x) => {
  if (stream._type === 1) {
    const index = index_of(stream._list, x);
    const len   = size(stream._list);

    assert(index_in_range(index, len));

    // TODO is this correct ?
    if (!is_sorted(stream._list, index, len, stream._sort)) {
      _remove(stream._list, index);
      event_remove(stream, index);
      sorted_insert(stream, x);
    }

    // TODO inefficient
    assert(is_all_sorted(stream._list, stream._sort));

  } else {
    fail();
  }
};


const event_insert = (stream, index, value) => {
  event.send(stream._events, record.make({
    "type": uuid_insert,
    "index": index,
    "value": value
  }));
};

const event_remove = (stream, index) => {
  event.send(stream._events, record.make({
    "type": uuid_remove,
    "index": index
  }));
};


export const clear = (stream) => {
  if (stream._type === 0 || stream._type === 1) {
    _clear(stream._list);

    event.send(stream._events, record.make({
      "type": uuid_clear
    }));

  } else {
    fail();
  }
};

export const on_change = (stream, f) => {
  if (stream._type === 0 || stream._type === 1) {
    f(record.make({
      "type": uuid_initial,
      "value": stream._list
    }));

    return event.on_receive(stream._events, f);


  } else if (stream._type === 2) {
    return on_change(stream._parent, (x) => {
      const type = record.get(x, "type");

      switch (type) {
      case uuid_initial:
        f(record.make({
          "type": type,
          // TODO a tiny bit hacky
          "value": record.get(x, "value")["map"]((x) => stream._fn(x))
        }));
        break;

      case uuid_insert:
      case uuid_update:
        f(record.make({
          "type": type,
          "index": record.get(x, "index"),
          "value": stream._fn(record.get(x, "value"))
        }));
        break;

      case uuid_remove:
      case uuid_clear:
        f(x);
        break;

      default:
        fail();
        break;
      }
    });


  } else {
    fail();
  }
};
