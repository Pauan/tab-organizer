import { Record } from "./immutable/record";
import { List } from "./immutable/list";
import { Some, None } from "./immutable/maybe";
import { Event } from "./event";
import { assert, fail } from "./assert";
import { each, to_array } from "./iterator";


const check_keys = (keys) => {
  assert(keys["length"] >= 1);
};

// TODO is this correct ?
// TODO is this needed ?
const nested_has = (init, keys) => {
  for (let i = 0; i < keys["length"]; ++i) {
    const key = keys[i];

    if (init.has(key)) {
      init = init.get(key);

    } else {
      return false;
    }
  }

  return true;
};

const nested_lookup = (init, keys, f) => {
  const end = keys["length"] - 1;

  let i = 0;

  // TODO test this
  while (i < end) {
    init = init.get(keys[i]);
    ++i;
  }

  return f(init, keys[i]);
};

const loop = (init, keys, i, end, f) => {
  const key = keys[i];

  if (i < end) {
    return init.modify(key, (x) => loop(x, keys, i + 1, end, f));

  } else {
    return f(init, key);
  }
};

const nested_modify = (init, keys, f) =>
  loop(init, keys, 0, keys["length"] - 1, f);


class Base {
  constructor(keys) {
    this._destroyed = false;
    this._keys = keys;
  }

  _destroy() {
    assert(!this._destroyed);

    this._destroyed = true;
    this._keys = null;
  }

  get_all() {
    assert(!this._destroyed);
    return this._keys;
  }

  has(keys) {
    assert(!this._destroyed);
    check_keys(keys);

    return nested_lookup(this._keys, keys, (x, key) => x.has(key));
  }

  get(keys) {
    assert(!this._destroyed);
    check_keys(keys);

    return nested_lookup(this._keys, keys, (x, key) => x.get(key));
  }
}


class Transaction extends Base {
  constructor(parent) {
    super(parent._keys);

    this._changes = List();
  }

  _push_change(x) {
    this._changes = this._changes.push(x);
  }

  _destroy() {
    super._destroy();

    this._changes = null;
  }

  _modify_key_value(type, keys, value, f) {
    assert(!this._destroyed);
    check_keys(keys);

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, keys, f);

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", type],
        ["table", this._keys],
        ["keys", List(keys)], // TODO a bit inefficient
        ["value", value]
      ]));
    }
  }

  default(keys, value) {
    this._modify_key_value("default", keys, value, (x, key) =>
      x.default(key, value));
  }

  insert(keys, value) {
    this._modify_key_value("insert", keys, value, (x, key) =>
      x.insert(key, value));
  }

  update(keys, value) {
    this._modify_key_value("update", keys, value, (x, key) =>
      x.update(key, value));
  }

  assign(keys, value) {
    this._modify_key_value("assign", keys, value, (x, key) =>
      x.assign(key, value));
  }

  remove(keys) {
    assert(!this._destroyed);
    check_keys(keys);

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, keys, (x, key) =>
      x.remove(key));

    assert(this._keys !== old_keys);

    this._push_change(Record([
      ["type", "remove"],
      ["table", this._keys],
      ["keys", List(keys)] // TODO a bit inefficient
    ]));
  }

  // TODO inefficient
  push(keys, value) {
    const list = this.get(keys);
    return this.insert([...keys, list.size], value);
  }

  // TODO test this
  modify(keys, f) {
    assert(!this._destroyed);
    check_keys(keys);

    // TODO this is a little hacky
    let new_value = None;

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, keys, (x, key) =>
      x.modify(key, (old_value) => {
        const x = f(old_value);
        new_value = Some(x);
        return x;
      }));

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", "update"],
        ["table", this._keys],
        ["keys", List(keys)], // TODO a bit inefficient
        ["value", new_value.get()]
      ]));

    } else {
      assert(new_value.has());
    }
  }

  // TODO test this
  set_all(new_db) {
    assert(!this._destroyed);

    const old_db = this._keys;

    each(old_db, ([key, value]) => {
      if (!new_db.has(key)) {
        this.remove([key]);
      }
    });

    each(new_db, ([key, value]) => {
      this.assign([key], value);
    });
  }
}


export class Table extends Base {
  constructor() {
    super(Record());

    this._on_commit = Event();
    this.on_commit  = this._on_commit.receive;
  }

  _commit_changes(changes) {
    this._on_commit.send(changes);
  }

  _destroy() {
    super._destroy();

    this._on_commit = null;
    this.on_commit = null;
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
      this._commit_changes(changes);

    } else {
      assert(changes.size === 0);
    }
  }
}
