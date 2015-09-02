import * as record from "./record";
import * as event from "./event";
import { each, entries } from "./iterator";


export class Table {
  constructor(keys = null) {
    if (keys == null) {
      this._keys = {};
    } else {
      this._keys = keys;
    }

    this.on_change = event.make();
  }

  _assign(key, value) {
    event.send(this.on_change, {
      type: "assign",
      key: key,
      value: value
    });
  }

  _remove(key) {
    event.send(this.on_change, {
      type: "remove",
      key: key
    });
  }

  get(...keys) {
    return record.get(this._keys, ...keys);
  }

  default(key, value) {
    record.default(this._keys, key, value);
  }

  write(key, f) {
    const value = record.get(this._keys, key);

    f(value);

    this._assign(key, value);
  }

  get_all() {
    return this._keys;
  }

  // TODO test this
  set_all(new_db) {
    const old_db = this._keys;

    // TODO is this inefficient ?
    each(entries(old_db), ([key]) => {
      if (!record.has(new_db, key)) {
        // TODO this removes a key while looping over the object, does that cause any issues ?
        record.remove(old_db, key);
        this._remove(key);
      }
    });

    // TODO is this inefficient ?
    each(entries(new_db), ([key, value]) => {
      record.assign(old_db, key, value);
      this._assign(key, value);
    });
  }
}
