export class Timer {
  constructor() {
    this._start = Date["now"]();
    this._end = null;
  }

  done() {
    this._end = Date["now"]();
  }

  diff() {
    if (this._end === null) {
      throw new Error("Timer is not done yet");
    } else {
      return this._end - this._start;
    }
  }
}
