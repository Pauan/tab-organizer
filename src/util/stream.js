import { Set } from "./mutable/set";
import { copy } from "./immutable/array";
import { Some, None } from "./immutable/maybe";


// TODO is this correct ?
const on_error = (e) => {
  throw e;
};

const noop = () => {};


export class Stream {
  constructor(fn) {
    this._fn = fn;
  }

  _cleanup() {
    this._fn = null;
  }

  _run(send, error, complete) {
    let stopped = false;

    const stop = this._fn(send, error, complete);

    // TODO is this necessary ?
    return () => {
      if (!stopped) {
        stopped = true;
        stop();
      }
    };
  }

  each(f) {
    return {
      stop: this._run(f, on_error, noop);
    };
  }

/*
  // TODO is this a good idea ?
  on_error(f) {
    return this._run(noop, f, noop);
  }

  // TODO is this a good idea ?
  on_complete(f) {
    return this._run(noop, on_error, f);
  }*/

  /*initial(x) {
    return new Stream((send, error, complete) => {
      send(x);

      return this._run(send, error, complete);
    });
  }*/

  // TODO is there a better abstraction / name than `using` ?
  using(x) {
    return new Stream((send, error, complete) => {
      const on_error = (err) => {
        cleanup();
        error(err);
      };

      const on_complete = () => {
        cleanup();
        complete();
      };

      const stop1 = this._run(send, on_error, on_complete);
      const stop2 = x._run(noop, on_error, on_complete);

      const cleanup = () => {
        stop1();
        stop2();
      };

      return cleanup;
    });
  }

  // TODO test this
  any(f) {
    return new Stream((send, error, complete) => {
      const stop = this._run((x) => {
        if (f(x)) {
          stop();
          send(true);
          complete();
        }
      }, error, () => {
        send(false);
        complete();
      });

      return stop;
    });
  }

  // TODO test this
  all(f) {
    return new Stream((send, error, complete) => {
      const stop = this._run((x) => {
        if (!f(x)) {
          stop();
          send(false);
          complete();
        }
      }, error, () => {
        send(true);
        complete();
      });

      return stop;
    });
  }

  keep_map(f) {
    return new Stream((send, error, complete) =>
      this._run((x) => {
        const maybe = f(x);
        if (maybe.has()) {
          send(maybe.get());
        }
      }, error, complete));
  }

  map(f) {
    return this.keep_map((x) => Some(f(x)));
  }

  keep(f) {
    return this.keep_map((x) => {
      if (f(x)) {
        return Some(x);
      } else {
        return None;
      }
    });
  }

  // TODO test this
  accumulate(init, f) {
    return new Stream((send, error, complete) => {
      send(init);

      return this._run((x) => {
        init = f(init, x);
        send(init);
      }, error, complete);
    });
  }

  fold(init, f) {
    return new Stream((send, error, complete) =>
      this._run((x) => {
        init = f(init, x);

      }, error, () => {
        send(init);
        complete();
      }));
  }
}


// TODO test this
export const concat = (args) =>
  new Stream((send, error, complete) => {
    const end = args["length"];

    // TODO is this correct ?
    let stop = noop;

    const loop = (i) => {
      if (i < end) {
        stop = args[i]._run(send, error, () => {
          loop(i + 1);
        });

      } else {
        complete();
      }
    };

    loop(0);

    return () => {
      stop();
    };
  });

// TODO test this
export const merge = (args) =>
  new Stream((send, error, complete) => {
    let pending_complete = args["length"];

    // TODO is this correct ?
    if (pending_complete === 0) {
      complete();
      return noop;

    } else {
      const stops = args["map"]((x) =>
        x._run(send, on_error, on_complete));

      // TODO can this call the stop function after it's already stopped ?
      const stop = () => {
        stops["forEach"]((f) => {
          f();
        });
      };

      const on_error = (err) => {
        stop();
        error(err);
      };

      const on_complete = () => {
        --pending_complete;
        if (pending_complete === 0) {
          complete();
        }
      };

      return stop;
    }
  });

// TODO test this
export const latest = (args) =>
  new Stream((send, error, complete) => {
    let pending_values = args["length"];

    // TODO is this correct ?
    if (pending_values === 0) {
      complete();
      return noop;

    } else {
      const values = new Array(args["length"]);

      const on_error = (err) => {
        stop();
        error(err);
      };

      const on_complete = () => {
        stop();
        complete();
      };

      const stops = args["map"]((x, i) => {
        let has = false;

        return x._run((x) => {
          values[i] = x;

          if (!has) {
            has = true;
            --pending_values;
          }

          if (pending_values === 0) {
            send(copy(values));
          }
        }, on_error, on_complete);
      });

      // TODO can this call the stop function after it's already stopped ?
      const stop = () => {
        stops["forEach"]((f) => {
          f();
        });
      };

      return stop;
    }
  });


// TODO is the `this` binding correct ?
const event_run = function (send, error, complete) {
  const info = { send, error, complete };

  this._listeners.add(info);

  return () => {
    this._listeners.remove(info);
  };
};

export class Event extends Stream {
  constructor() {
    super(event_run);

    this._listeners = new Set();
  }

  _cleanup() {
    super._cleanup();

    this._listeners = null;
  }

  send(value) {
    each(this._listeners, ({ send }) => {
      send(value);
    });
  }

  error(err) {
    const listeners = this._listeners;

    this._cleanup();

    each(listeners, ({ error }) => {
      error(err);
    });
  }

  complete() {
    const listeners = this._listeners;

    this._cleanup();

    each(listeners, ({ complete }) => {
      complete();
    });
  }
}
