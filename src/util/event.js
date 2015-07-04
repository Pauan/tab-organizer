import { Set } from "./mutable/set";
import { each } from "./iterator";


export class Event {
  constructor() {
    this._listeners = new Set();
  }

  listen(f) {
    this._listeners.add(f);

    return {
      unlisten: () => {
        this._listeners.remove(f);
      }
    };
  }

  send(value) {
    each(this._listeners, (f) => {
      f(value);
    });
  }
}
