import { map, iterator } from "../iterator";
import { fail } from "../assert";
import { List, SortedList } from "./list";
import { Event } from "../event";


export const uuid_stream_insert = "fa4a6522-a031-4294-861e-d536b21b3b2d";
export const uuid_stream_remove = "df55a53e-ce78-40b4-b751-d6a356f311c2";
export const uuid_stream_update = "e51c3816-c859-47d0-a93c-e49c9e7e5be4";
export const uuid_stream_clear  = "91e20a2a-55c1-4b7f-b2ca-d82d543f5a6c";


export class ListStream extends List {
  constructor(x = null) {
    super(x);

    this._event = Event();
  }

  // TODO code duplication
  map(f) {
    return new Map(this, f);
  }

  on_change(f) {
    return this._event.receive(f);
  }

  _clear() {
    super._clear();

    this._event.send({
      type: uuid_stream_clear
    });
  }

  _update(index, value) {
    super._update(index, value);

    this._event.send({
      type: uuid_stream_update,
      index: index,
      value: value
    });
  }

  _insert(index, value) {
    super._insert(index, value);

    this._event.send({
      type: uuid_stream_insert,
      index: index,
      value: value
    });
  }

  _remove(index) {
    super._remove(index);

    this._event.send({
      type: uuid_stream_remove,
      index: index
    });
  }
}


export class SortedListStream extends SortedList {
  constructor(sort) {
    super(sort);

    this._event = Event();
  }

  // TODO code duplication
  map(f) {
    return new Map(this, f);
  }

  // TODO code duplication
  on_change(f) {
    return this._event.receive(f);
  }

  // TODO code duplication
  _clear() {
    super._clear();

    this._event.send({
      type: uuid_stream_clear
    });
  }

  // TODO code duplication
  _insert(index, value) {
    super._insert(index, value);

    this._event.send({
      type: uuid_stream_insert,
      index: index,
      value: value
    });
  }

  // TODO code duplication
  _remove(index) {
    super._remove(index);

    this._event.send({
      type: uuid_stream_remove,
      index: index
    });
  }
}


class Map {
  constructor(parent, fn) {
    this._parent = parent;
    this._fn = fn;
  }

  // TODO code duplication
  map(f) {
    return new Map(this, f);
  }

  on_change(f) {
    return this._parent.on_change((x) => {
      switch (x.type) {
      case uuid_stream_insert:
      case uuid_stream_update:
        f({
          type: x.type,
          index: x.index,
          value: this._fn(x.value)
        });
        break;

      case uuid_stream_remove:
      case uuid_stream_clear:
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
    return iterator(map(this._parent, this._fn));
  }
}
