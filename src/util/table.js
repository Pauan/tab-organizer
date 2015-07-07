import { Record } from "./immutable/record";
import { List } from "./immutable/list";
import { Some, None } from "./immutable/maybe";
import { Event } from "./event";
import { assert } from "./assert";


const lookup = (init, keys, f) => {
  assert(keys["length"] >= 1);

  let i = 0;

  // TODO test this
  while (i < keys["length"] - 1) {
    init = init.get(keys[i]);
    ++i;
  }

  return f(init, keys[i]);
};

const loop = (init, keys, i, end, f) => {
  const key = keys[i];

  if (i === end) {
    return f(init, key);

  } else {
    return init.update(key, (x) => loop(x, keys, i + 1, end, f));
  }
};

const update = (init, keys, f) => {
  assert(keys["length"] >= 1);

  return loop(init, keys, 0, keys["length"] - 1, f);
};


export class Table {
  constructor(x = null) {
    this._destroyed = false;
    this.on_change = new Event();

    if (x == null) {
      this._keys = Record();
    } else {
      this._keys = x;
    }
  }

  _push_change(x) {
    this.on_change.send(List([x]));
  }

  get_all() {
    assert(!this._destroyed);
    return this._keys;
  }

  // TODO test this
  set_all(new_db) {
    assert(!this._destroyed);

    const old_db = this._keys;

    this.transaction((db) => {
      each(old_db, ([key, value]) => {
        if (!new_db.has(key)) {
          db.remove([key]);
        }
      });

      each(new_db, ([key, value]) => {
        if (db.has([key])) {
          db.set([key], value);
        } else {
          db.add([key], value);
        }
      });
    });
  }

  // TODO code duplication
  default(keys, value) {
    assert(!this._destroyed);

    const old_keys = this._keys;

    this._keys = update(old_keys, keys, (x, key) => x.default(key, value));

    // TODO test this
    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", "default"],
        ["table", this._keys],
        ["key", List(keys)],
        ["value", value]
      ]));
    }
  }

  has(keys) {
    assert(!this._destroyed);
    return lookup(this._keys, keys, (x, key) => x.has(key));
  }

  get(keys) {
    assert(!this._destroyed);
    return lookup(this._keys, keys, (x, key) => x.get(key));
  }

  add(keys, value) {
    assert(!this._destroyed);

    this._keys = update(this._keys, keys, (x, key) => x.add(key, value));

    // No need to check for changes, because `add` always changes the Record
    this._push_change(Record([
      ["type", "add"],
      ["table", this._keys],
      ["key", List(keys)],
      ["value", value]
    ]));
  }

  remove(keys) {
    assert(!this._destroyed);

    this._keys = update(this._keys, keys, (x, key) => x.remove(key));

    // No need to check for changes, because `remove` always changes the Record
    this._push_change(Record([
      ["type", "remove"],
      ["table", this._keys],
      ["key", List(keys)]
    ]));
  }

  // TODO code duplication
  set(keys, value) {
    assert(!this._destroyed);

    const old_keys = this._keys;

    this._keys = update(old_keys, keys, (x, key) => x.set(key, value));

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", "set"],
        ["table", this._keys],
        ["key", List(keys)],
        ["value", value]
      ]));
    }
  }

  // TODO test this
  update(keys, f) {
    assert(!this._destroyed);

    // TODO this is a little hacky
    let new_value = None();

    const old_keys = this._keys;

    this._keys = update(old_keys, keys, (x, key) =>
      x.update(key, (old_value) => {
        const x = f(old_value);
        new_value = Some(x);
        return x;
      }));

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", "set"],
        ["table", this._keys],
        ["key", List(keys)],
        ["value", new_value.get()]
      ]));

    } else {
      assert(new_value.has());
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
