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


// TODO this probably isn't super-robust, but it should work for common cases
let max = null;

// Guarantees uniqueness
export const timestamp = () => {
  const x = Date["now"]();
  if (max === null || x > max) {
    max = x;
  } else {
    ++max;
  }
  return max;
};
