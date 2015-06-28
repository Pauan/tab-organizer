import { Set } from "./set";
import { each } from "./iterator";


export class Event {
  constructor() {
    this._listeners = new Set();
  }

  listen(f) {
    this._listeners.add(f);
  }

  send(value) {
    each(this._listeners, (f) => {
      f(value);
    });
  }
}
