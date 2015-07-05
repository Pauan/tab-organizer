class Maybe {
  constructor(x) {
    this._maybe = x;
  }

  has() {
    // TODO test this
    return this._maybe["length"] === 1;
  }

  get() {
    // TODO test this
    if (this._maybe["length"] === 1) {
      return this._maybe[0];
    } else {
      throw new Error("Cannot get from None");
    }
  }
}

export const None = () => new Maybe([]);

export const Some = (x) => new Maybe([x]);
