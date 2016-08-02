/* @flow */
import * as $list from "./list";
import * as $event from "./event";
import * as $maybe from "./maybe";
import * as $array from "./array";
import * as $running from "./running";
import { assert, crash } from "./assert";


type Initial<A> = {
  type: "initial",
  value: $list.List<A>
};

type Insert<A> = {
  type: "insert",
  index: number,
  value: A
};

type Update<A> = {
  type: "update",
  index: number,
  value: A
};

type Remove = {
  type: "remove",
  index: number
};

type Clear = {
  type: "clear"
};

export type Delta<A> = Initial<A> | Insert<A> | Update<A> | Remove | Clear;

type List<A> = {
  _type: 0,
  _list: $list.List<A>,
  _events: $event.Event<Delta<A>>
};

type Sorted<A> = {
  _type: 1,
  _list: Array<A>,
  _events: $event.Event<Delta<A>>,
  _sort: $array.Sorter<A>
};

type Map<A, B> = {
  _type: 2,
  _parent: Stream<A>,
  _fn: (_: A) => B
};

export type Stream<A> = List<A> | Sorted<A> | Map<*, A>;


export const make_list = <A>(...x: Array<A>): List<A> => {
  return {
    _type: 0,
    _list: $list.make(...x),
    _events: $event.make()
  };
};

export const make_sorted_list = <A>(sort: $array.Sorter<A>): Sorted<A> => {
  return {
    _type: 1,
    _list: [],
    _events: $event.make(),
    _sort: sort
  };
};

export const map = <A, B>(parent: Stream<A>, fn: (_: A) => B): Map<A, B> => {
  return {
    _type: 2,
    _parent: parent,
    _fn: fn
  };
};


const event_insert = <A>(stream: List<A> | Sorted<A>, index: number, value: A): void => {
  $event.send(stream._events, {
    type: "insert",
    index: index,
    value: value
  });
};

const event_remove = <A>(stream: List<A> | Sorted<A>, index: number): void => {
  $event.send(stream._events, {
    type: "remove",
    index: index
  });
};

const event_clear = <A>(stream: List<A>): void => {
  $event.send(stream._events, {
    type: "clear"
  });
};


export const current = <A>(stream: List<A> | Sorted<A>): $list.List<A> => {
  if (stream._type === 0 || stream._type === 1) {
    return stream._list;

  } else {
    return crash();
  }
};


export const insert = <A>(stream: List<A>, index: number, x: A): void => {
  if (stream._type === 0) {
    $list.insert(stream._list, index, x);
    event_insert(stream, index, x);

  } else {
    crash();
  }
};

export const push = <A>(stream: List<A>, x: A): void => {
  if (stream._type === 0) {
    $list.push(stream._list, x);
    // TODO is this correct ?
    event_insert(stream, $list.size(stream._list) - 1, x);

  } else {
    crash();
  }
};

export const remove = <A>(stream: List<A>, index: number): void => {
  if (stream._type === 0) {
    $list.remove(stream._list, index);
    event_remove(stream, index);

  } else {
    crash();
  }
};

export const clear = <A>(stream: List<A>): void => {
  if (stream._type === 0) {
    $list.clear(stream._list);
    event_clear(stream);

  } else {
    crash();
  }
};


/*export const sorted_has = (stream, x) => {
  if (stream._type === 1) {
    const { value } = $array.get_sorted(stream._list, x, stream._sort);
    return $maybe.has(value);

  } else {
    crash();
  }
};*/

export const sorted_insert = <A>(stream: Sorted<A>, x: A): void => {
  if (stream._type === 1) {
    const { index, value } = $array.get_sorted(stream._list, x, stream._sort);

    assert(!$maybe.has(value));

    $array.insert(stream._list, index, x);
    event_insert(stream, index, x);

    // TODO inefficient
    assert($array.is_all_sorted(stream._list, stream._sort));

  } else {
    crash();
  }
};

export const sorted_remove = <A>(stream: Sorted<A>, x: A): void => {
  if (stream._type === 1) {
    const { index, value } = $array.get_sorted(stream._list, x, stream._sort);

    assert($maybe.get(value) === x);

    $array.remove(stream._list, index);
    event_remove(stream, index);

    // TODO inefficient
    assert($array.is_all_sorted(stream._list, stream._sort));

  } else {
    crash();
  }
};

// TODO when the sorting is incorrect, rather than doing an `index_of` followed by `get_sorted`, it might be faster to do a `get_sorted` followed by an `index_of`
export const sorted_update = <A>(stream: Sorted<A>, x: A): void => {
  if (stream._type === 1) {
    // TODO is there a more efficient way to do this ?
    const index = $array.index_of(stream._list, x);
    const len   = $array.size(stream._list);

    assert($array.index_in_range(index, len));

    // TODO is this correct ?
    if (!$array.is_sorted(stream._list, index, len, stream._sort)) {
      $array.remove(stream._list, index);
      event_remove(stream, index);
      sorted_insert(stream, x);

    } else {
      // TODO inefficient
      assert($array.is_all_sorted(stream._list, stream._sort));
    }

  } else {
    crash();
  }
};


const listen_map = <A, B>(stream: Map<B, A>, f: (_: Delta<A>) => void): $running.Runner => {
  return listen(stream._parent, (x) => {
    if (x.type === "initial") {
      f({
        type: "initial",
        value: $list.map(x.value, stream._fn)
      });

    } else if (x.type === "insert") {
      f({
        type: "insert",
        index: x.index,
        value: stream._fn(x.value)
      });

    } else if (x.type === "update") {
      f({
        type: "update",
        index: x.index,
        value: stream._fn(x.value)
      });

    } else if (x.type === "remove" || x.type === "clear") {
      f(x);

    } else {
      crash();
    }
  });
};


export const listen = <A>(stream: Stream<A>, f: (_: Delta<A>) => void): $running.Runner => {
  if (stream._type === 0 ||
      stream._type === 1) {

    f({
      type: "initial",
      value: stream._list
    });

    return $event.on_receive(stream._events, f);

  } else if (stream._type === 2) {
    return listen_map(stream, f);

  } else {
    return crash();
  }
};
