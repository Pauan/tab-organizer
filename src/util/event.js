import { None, Some } from "./immutable/maybe";
import { Set } from "./mutable/set";
import { each } from "./iterator";
import { assert } from "./assert";


// TODO add a `destroy` method ?
export class Event {
  constructor(info = {}) {
    this._listeners = new Set();
    this._info = info;
    this._bind = None();
  }

  listen(f) {
    this._listeners.add(f);

    // TODO test this
    if (this._info.bind && this._listeners.size === 1) {
      assert(!this._bind.has());
      this._bind = Some(this._info.bind(this));
    }

    return {
      unlisten: () => {
        this._listeners.remove(f);

        // TODO test this
        if (this._info.unbind && this._listeners.size === 0) {
          this._info.unbind(this, this._bind.get());
          this._bind = None();
        }
      }
    };
  }

  send(value) {
    each(this._listeners, (f) => {
      f(value);
    });
  }
}
