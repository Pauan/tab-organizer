import { Record } from "./immutable/record";
import { List } from "./immutable/list";
import { Event } from "./event";
import { assert } from "./assert";


export class Table {
  constructor() {
    this._destroyed = false;
    this._keys = Record();
    this.on_change = new Event();
  }

  _push_change(x) {
    this.on_change.send(List([x]));
  }

  get_all() {
    assert(!this._destroyed);
    return this._keys;
  }

  set_all(value) {
    assert(!this._destroyed);

    if (this._keys !== value) {
      this._keys = value;

      this._push_change(Record([
        ["type", "set_all"],
        ["value", value]
      ]));
    }
  }

  default(key, value) {
    assert(!this._destroyed);

    if (!this._keys.has(key)) {
      this._keys = this._keys.add(key, value);

      this._push_change(Record([
        ["type", "default"],
        ["key", key],
        ["value", value]
      ]));
    }
  }

  has(key) {
    assert(!this._destroyed);
    return this._keys.has(key);
  }

  get(key) {
    assert(!this._destroyed);
    return this._keys.get(key);
  }

  add(key, value) {
    assert(!this._destroyed);

    this._keys = this._keys.add(key, value);

    // No need to check for changes, because `add` always changes the Record
    this._push_change(Record([
      ["type", "add"],
      ["key", key],
      ["value", value]
    ]));
  }

  remove(key) {
    assert(!this._destroyed);

    this._keys = this._keys.remove(key);

    // No need to check for changes, because `remove` always changes the Record
    this._push_change(Record([
      ["type", "remove"],
      ["key", key]
    ]));
  }

  set(key, value) {
    assert(!this._destroyed);

    const old_keys = this._keys;
    const new_keys = old_keys.set(key, value);

    if (new_keys !== old_keys) {
      this._keys = new_keys;

      this._push_change(Record([
        ["type", "set"],
        ["key", key],
        ["value", value]
      ]));
    }
  }

  // TODO test this
  update(key, f) {
    assert(!this._destroyed);

    const old_keys  = this._keys;
    const old_value = old_keys.get(key);
    const new_value = f(old_value);
    const new_keys  = old_keys.set(key, new_value);

    if (new_keys !== old_keys) {
      this._keys = new_keys;

      this._push_change(Record([
        ["type", "set"],
        ["key", key],
        ["value", new_value]
      ]));
    }
  }

  // TODO guarantee that it's impossible to create conflicts
  transaction(f) {
    assert(!this._destroyed);

    const transaction = new Transaction(this);

    f(transaction);

    const keys    = transaction._keys;
    const changes = transaction._changes;

    transaction._destroy();

    if (this._keys !== keys) {
      assert(changes.size > 0);

      this._keys = keys;
      this.on_change.send(changes);

    } else {
      assert(changes.size === 0);
    }
  }
}


class Transaction extends Table {
  constructor(parent) {
    super();
    this._destroyed = false;
    this._keys = parent._keys;
    this._changes = List();
  }

  _push_change(x) {
    this._changes = this._changes.push(x);
  }

  _destroy() {
    assert(!this._destroyed);

    this._destroyed = true;
    this._keys = null;
    this._changes = null;
  }

  // TODO code duplication
  // TODO guarantee that it's impossible to create conflicts
  transaction(f) {
    assert(!this._destroyed);

    const transaction = new Transaction(this);

    f(transaction);

    const keys    = transaction._keys;
    const changes = transaction._changes;

    transaction._destroy();

    if (this._keys !== keys) {
      assert(changes.size > 0);

      this._keys = keys;
      this._changes = this._changes.concat(changes);

    } else {
      assert(changes.size === 0);
    }
  }
}
