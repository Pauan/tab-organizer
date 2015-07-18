export class Timer {
  constructor() {
    this._start = current_time();
    this._end = null;
  }

  done() {
    this._end = current_time();
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
  const x = current_time();
  if (max === null || x > max) {
    max = x;
  } else {
    ++max;
  }
  return max;
};



export const millisecond = 1;
export const second      = 1000 * millisecond;
export const minute      = 60   * second;
export const hour        = 60   * minute;
export const day         = 24   * hour;


export const current_time = () =>
  Date["now"]();

// TODO test this
export const to_local_time = (x) =>
  x - (new Date(x)["getTimezoneOffset"]() * minute);

export const round_to_second = (x) => {
  const t = new Date(x);
  t["setMilliseconds"](0);
  return +t;
};

export const round_to_minute = (x) => {
  const t = new Date(x);
  t["setSeconds"](0);
  t["setMilliseconds"](0);
  return +t;
};

export const round_to_hour = (x) => {
  const t = new Date(x);
  t["setMinutes"](0);
  t["setSeconds"](0);
  t["setMilliseconds"](0);
  return +t;
};

export const round_to_day = (x) => {
  const t = new Date(x);
  t["setHours"](0);
  t["setMinutes"](0);
  t["setSeconds"](0);
  t["setMilliseconds"](0);
  return +t;
};

export const round_to_month = (x) => {
  const t = new Date(x);
  t["setDate"](1);
  t["setHours"](0);
  t["setMinutes"](0);
  t["setSeconds"](0);
  t["setMilliseconds"](0);
  return +t;
};

export const round_to_year = (x) => {
  const t = new Date(x);
  t["setMonth"](0);
  t["setDate"](1);
  t["setHours"](0);
  t["setMinutes"](0);
  t["setSeconds"](0);
  t["setMilliseconds"](0);
  return +t;
};

export const difference = (x, y) => {
  const diff = Math["abs"](y - x);
  return {
    millisecond: diff,
    second: Math["floor"](diff / second),
    minute: Math["floor"](diff / minute),
    hour:   Math["floor"](diff / hour),
    day:    Math["floor"](diff / day)
  }
};
