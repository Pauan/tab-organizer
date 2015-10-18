import * as list from "./list";
import * as record from "./record";
import * as event from "./event";
import * as maybe from "./maybe";
import * as array from "./array";
import { assert, crash } from "./assert";


export const uuid_initial = "9fea84a4-c36f-4ecf-a1d2-9bbcf778385b";
export const uuid_insert  = "fa4a6522-a031-4294-861e-d536b21b3b2d";
export const uuid_remove  = "df55a53e-ce78-40b4-b751-d6a356f311c2";
export const uuid_update  = "e51c3816-c859-47d0-a93c-e49c9e7e5be4";
export const uuid_clear   = "91e20a2a-55c1-4b7f-b2ca-d82d543f5a6c";


export const make_list = (...x) => {
  return {
    _type: 0,
    _list: list.make(...x),
    _events: event.make()
  };
};

export const make_sorted_list = (sort) => {
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

const event_clear = (stream) => {
  event.send(stream._events, record.make({
    "type": uuid_clear
  }));
};


export const current = (stream) => {
  if (stream._type === 0 || stream._type === 1) {
    return stream._list;

  } else {
    crash();
  }
};


export const insert = (stream, index, x) => {
  if (stream._type === 0) {
    list.insert(stream._list, index, x);
    event_insert(stream, index, x);

  } else {
    crash();
  }
};

export const push = (stream, x) => {
  if (stream._type === 0) {
    list.push(stream._list, x);
    // TODO is this correct ?
    event_insert(stream, list.size(stream._list) - 1, x);

  } else {
    crash();
  }
};

export const remove = (stream, index) => {
  if (stream._type === 0) {
    list.remove(stream._list, index);
    event_remove(stream, index);

  } else {
    crash();
  }
};

export const clear = (stream) => {
  if (stream._type === 0) {
    list.clear(stream._list);
    event_clear(stream);

  } else {
    crash();
  }
};


/*export const sorted_has = (stream, x) => {
  if (stream._type === 1) {
    const { value } = array.get_sorted(stream._list, x, stream._sort);
    return maybe.has(value);

  } else {
    crash();
  }
};*/

export const sorted_insert = (stream, x) => {
  if (stream._type === 1) {
    const { index, value } = array.get_sorted(stream._list, x, stream._sort);

    assert(!maybe.has(value));

    array.insert(stream._list, index, x);
    event_insert(stream, index, x);

    // TODO inefficient
    assert(array.is_all_sorted(stream._list, stream._sort));

  } else {
    crash();
  }
};

export const sorted_remove = (stream, x) => {
  if (stream._type === 1) {
    const { index, value } = array.get_sorted(stream._list, x, stream._sort);

    assert(maybe.get(value) === x);

    array.remove(stream._list, index);
    event_remove(stream, index);

    // TODO inefficient
    assert(array.is_all_sorted(stream._list, stream._sort));

  } else {
    crash();
  }
};

// TODO when the sorting is incorrect, rather than doing an `index_of` followed by `get_sorted`, it might be faster to do a `get_sorted` followed by an `index_of`
export const sorted_update = (stream, x) => {
  if (stream._type === 1) {
    // TODO is there a more efficient way to do this ?
    const index = array.index_of(stream._list, x);
    const len   = array.size(stream._list);

    assert(array.index_in_range(index, len));

    // TODO is this correct ?
    if (!array.is_sorted(stream._list, index, len, stream._sort)) {
      array.remove(stream._list, index);
      event_remove(stream, index);
      sorted_insert(stream, x);

    } else {
      // TODO inefficient
      assert(array.is_all_sorted(stream._list, stream._sort));
    }

  } else {
    crash();
  }
};


export const listen = (stream, f) => {
  if (stream._type === 0 ||
      stream._type === 1) {

    f(record.make({
      "type": uuid_initial,
      "value": stream._list
    }));

    return event.on_receive(stream._events, f);


  } else if (stream._type === 2) {
    return listen(stream._parent, (x) => {
      const type = record.get(x, "type");

      switch (type) {
      case uuid_initial:
        const fn = stream._fn;
        const value = record.get(x, "value");

        f(record.make({
          "type": type,
          // We don't want to pass the index to `fn`
          "value": array.map(value, (x) => fn(x))
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
        crash();
        break;
      }
    });


  } else {
    crash();
  }
};
