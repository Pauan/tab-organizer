import { fail } from "../assert";


class _None {
  constructor() {}

  // TODO maybe use static properties rather than methods ?
  has() {
    return false;
  }

  // TODO maybe use a getter rather than methods ?
  get() {
    fail(new Error("Cannot get from None"));
  }
}

class _Some {
  constructor(x) {
    this._value = x;
  }

  has() {
    return true;
  }

  get() {
    return this._value;
  }
}

export const None = new _None();

export const Some = (x) => new _Some(x);
