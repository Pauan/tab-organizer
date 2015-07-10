import { Record } from "./immutable/record";
import { List } from "./immutable/list";
import { Some, None } from "./immutable/maybe";
import { Event } from "./stream";
import { assert } from "./assert";
import { each, to_array } from "./iterator";


const nested_lookup = (init, keys, f) => {
  // TODO test this
  for (let i = 0; i < keys["length"]; ++i) {
    init = init.get(keys[i]);
  }

  return f(init);
};

const loop = (init, keys, i, end, f) => {
  if (i < end) {
    return init.modify(keys[i], (x) => loop(x, keys, i + 1, end, f));

  } else {
    return f(init);
  }
};

const nested_modify = (init, keys, f) =>
  loop(init, keys, 0, keys["length"], f);


class Base {
  constructor(keys, path) {
    this._destroyed = false;
    this._keys = keys;
    this._path = path;
  }

  _destroy() {
    assert(!this._destroyed);

    this._destroyed = true;
    this._keys = null;
    this._path = null;
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

  sub(path, f) {
    const x = new Subpath(this, path);
    f(x);
    x._destroy();
  }


  _modify_key_value(type, key, value, f) {
    assert(!this._destroyed);

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, this._path, f);

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", type],
        ["table", this._keys],
        ["path", List(this._path)], // TODO a bit inefficient
        ["key", key],
        ["value", value]
      ]));
    }
  }

  _modify_value(type, value, f) {
    assert(!this._destroyed);

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, this._path, f);

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", type],
        ["table", this._keys],
        ["path", List(this._path)], // TODO a bit inefficient
        ["value", value]
      ]));
    }
  }

  has(key) {
    assert(!this._destroyed);
    return nested_lookup(this._keys, this._path, (x) => x.has(key));
  }

  get(key) {
    assert(!this._destroyed);
    return nested_lookup(this._keys, this._path, (x) => x.get(key));
  }

  index_of(value) {
    assert(!this._destroyed);
    return nested_lookup(this._keys, this._path, (x) => x.index_of(value));
  }

  default(key, value) {
    this._modify_key_value("default", key, value, (x) => x.default(key, value));
  }

  insert(key, value) {
    this._modify_key_value("insert", key, value, (x) => x.insert(key, value));
  }

  update(key, value) {
    this._modify_key_value("update", key, value, (x) => x.update(key, value));
  }

  assign(key, value) {
    this._modify_key_value("assign", key, value, (x) => x.assign(key, value));
  }

  concat(value) {
    this._modify_value("concat", value, (x) => x.concat(value));
  }

  push(value) {
    this._modify_value("push", value, (x) => x.push(value));
  }

  clear() {
    assert(!this._destroyed);

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, this._path, (x) => x.clear());

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", "clear"],
        ["table", this._keys],
        ["path", List(this._path)] // TODO a bit inefficient
      ]));
    }
  }

  remove(key) {
    assert(!this._destroyed);

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, this._path, (x) =>
      x.remove(key));

    assert(this._keys !== old_keys);

    this._push_change(Record([
      ["type", "remove"],
      ["table", this._keys],
      ["path", List(this._path)], // TODO a bit inefficient
      ["key", key]
    ]));
  }

  // TODO test this
  modify(key, f) {
    assert(!this._destroyed);

    // TODO this is a little hacky
    let new_value = None;

    const old_keys = this._keys;

    this._keys = nested_modify(old_keys, this._path, (x) =>
      x.modify(key, (old_value) => {
        const x = f(old_value);
        new_value = Some(x);
        return x;
      }));

    if (this._keys !== old_keys) {
      this._push_change(Record([
        ["type", "update"],
        ["table", this._keys],
        ["path", List(this._path)], // TODO a bit inefficient
        ["key", key],
        ["value", new_value.get()]
      ]));

    } else {
      assert(new_value.has());
    }
  }
}


class Subpath extends Base {
  constructor(parent, path) {
    // TODO test this
    super(parent._keys, parent._path["concat"](path));
    this._parent = parent;
  }

  _push_change(x) {
    // TODO test this
    // TODO what if the parent's keys changed ?
    this._parent.keys = this._keys;
    this._parent._push_change(x);
  }

  _commit_changes(changes) {
    this._parent._commit_changes(changes);
  }

  _destroy() {
    super._destroy();

    this._parent = null;
  }
}


class Transaction extends Base {
  constructor(parent) {
    super(parent._keys, parent._path);
    this._changes = List();
  }

  _push_change(x) {
    this._changes = this._changes.push(x);
  }

  _commit_changes(changes) {
    this._changes = this._changes.concat(changes);
  }

  _destroy() {
    super._destroy();

    this._changes = null;
  }
}


export class Table extends Base {
  constructor(keys = null) {
    // TODO assert that keys is a Record ?
    if (keys == null) {
      keys = Record();
    }

    super(keys, []);

    // TODO replace with Stream ?
    this.on_commit = new Event();
  }

  _push_change(x) {
    this.on_commit.send(List([x]));
  }

  _commit_changes(changes) {
    this.on_commit.send(changes);
  }

  _destroy() {
    super._destroy();

    this.on_commit = null;
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
          db.remove(key);
        }
      });

      each(new_db, ([key, value]) => {
        db.assign(key, value);
      });
    });
  }

  // TODO test this
  commit_transaction(transaction) {
    this.transaction((db) => {
      each(transaction, (x) => {
        // TODO a bit hacky to use to_array
        db.sub(to_array(x.get("path")), (db) => {
          switch (x.get("type")) {
          case "update":
            db.update(x.get("key"), x.get("value"));
            break;

          case "assign":
            db.assign(x.get("key"), x.get("value"));
            break;

          case "insert":
            db.insert(x.get("key"), x.get("value"));
            break;

          case "default":
            db.default(x.get("key"), x.get("value"));
            break;

          case "push":
            db.push(x.get("value"));
            break;

          case "concat":
            db.concat(x.get("value"));
            break;

          case "remove":
            db.remove(x.get("key"));
            break;

          case "clear":
            db.clear();
            break;

          default:
            fail();
          }
        });
      });
    });
  }
}
