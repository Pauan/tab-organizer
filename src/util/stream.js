import { Set } from "./immutable/set";
import { each } from "./iterator";
import { Some, None } from "./immutable/maybe";


// TODO is this correct ?
const on_error = (e) => {
  throw e;
};

const noop = () => {};


class _Stream {
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
      stop: this._run(f, on_error, noop)
    };
  }

  indexed() {
    return Stream((send, error, complete) => {
      let i = 0;

      return this._run((x) => {
        send([i, x]);
        ++i;
      }, error, complete);
    });
  }

  initial(x) {
    return Stream((send, error, complete) => {
      send(x);

      return this._run(send, error, complete);
    });
  }

  finally(f) {
    return Stream((send, error, complete) =>
      this._run(send, (err) => {
        f();
        error(err);

      }, () => {
        f();
        complete();
      }));
  }

  run() {
    return this.each(noop);
  }

  // TODO is this correct ?
  forever() {
    return Stream((send, error, complete) => {
      let stop;

      const loop = () => {
        stop = this._run(send, error, loop);
      };

      loop();

      return () => {
        stop();
      };
    });
  }

  /*ignore() {
    return Stream((send, error, complete) =>
      this._run(noop, error, complete));
  }*/

  // TODO test this
  any(f) {
    return Stream((send, error, complete) => {
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
    return Stream((send, error, complete) => {
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
    return Stream((send, error, complete) =>
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
    return Stream((send, error, complete) => {
      send(init);

      return this._run((x) => {
        init = f(init, x);
        send(init);
      }, error, complete);
    });
  }

  fold(init, f) {
    return Stream((send, error, complete) =>
      this._run((x) => {
        init = f(init, x);

      }, error, () => {
        send(init);
        complete();
      }));
  }

  delay(ms) {
    return Stream((send, error, complete) => {
      const id = setTimeout(() => {
        stop = this._run(send, error, complete);
      }, ms);

      let stop = () => {
        clearTimeout(id);
      };

      return () => {
        stop();
      };
    });
  }

  // TODO test this
  skip_duplicates() {
    return Stream((send, error, complete) => {
      let value = None;

      this._run((x) => {
        if (!value.has() || value.get() !== x) {
          value = Some(x);
          send(x);
        }
      }, error, complete);
    });
  }

  // TODO test this
  get(key) {
    return this.map((value) => value.get(key)).skip_duplicates();
  }
}

export const Stream = (f) => new _Stream(f);


// TODO is this correct ?
export const not = (x) =>
  x.map((x) => !x);

// TODO is this correct ?
export const and = (args) =>
  latest(args, (...args) => {
    for (let i = 0; i < args["length"]; ++i) {
      if (!args[i]) {
        return false;
      }
    }

    return true;
  });

// TODO is this correct ?
export const or = (args) =>
  latest(args, (...args) => {
    for (let i = 0; i < args["length"]; ++i) {
      if (args[i]) {
        return true;
      }
    }

    return false;
  });

// TODO should this call `complete` ?
export const always = (x) =>
  Stream((send, error, complete) => {
    send(x);
    return noop;
  });

// TODO test this
export const concat = (args) =>
  Stream((send, error, complete) => {
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

export const empty = Stream((send, error, complete) => {
  complete();
  return noop;
});

// TODO test this
export const merge = (args) =>
  Stream((send, error, complete) => {
    let pending_complete = args["length"];

    // TODO is this correct ?
    if (pending_complete === 0) {
      complete();
      return noop;

    } else {
      // TODO test this
      // TODO is it possible for this to be called before `stop` is defined ?
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

      const stops = args["map"]((x) =>
        x._run(send, on_error, on_complete));

      // TODO can this call the stop function after it's already stopped ?
      const stop = () => {
        stops["forEach"]((f) => {
          f();
        });
      };

      return stop;
    }
  });

// TODO test this
export const latest = (args, f) =>
  Stream((send, error, complete) => {
    let pending_values = args["length"];

    // TODO is this correct ?
    if (pending_values === 0) {
      complete();
      return noop;

    } else {
      const values = new Array(args["length"]);

      // TODO is it possible for this to be called before `stop` is defined ?
      const on_error = (err) => {
        stop();
        error(err);
      };

      // TODO is it possible for this to be called before `stop` is defined ?
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
            send(f(...values));
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

// TODO test this
export const race = (args) =>
  Stream((send, error, complete) => {
    if (args["length"] === 0) {
      complete();
      return noop;

    } else {
      // TODO is it possible for this to be called before `stop` is defined ?
      const on_error = (err) => {
        stop();
        error(err);
      };

      // TODO is it possible for this to be called before `stop` is defined ?
      const on_complete = () => {
        stop();
        complete();
      };

      const stops = args["map"]((x) =>
        x._run(noop, on_error, on_complete));

      // TODO can this call the stop function after it's already stopped ?
      const stop = () => {
        stops["forEach"]((f) => {
          f();
        });
      };

      return stop;
    }
  });


export const Event = () => {
  let listeners = Set();

  const output = Stream((send, error, complete) => {
    const info = { send, error, complete };

    listeners = listeners.insert(info);

    return () => {
      listeners = listeners.remove(info);
    };
  });

  const cleanup = () => {
    listeners = null;
  };

  const send = (value) => {
    each(listeners, ({ send }) => {
      send(value);
    });
  };

  // TODO is it possible for the error to be swallowed ?
  const error = (err) => {
    const a = listeners;

    cleanup();

    each(a, ({ error }) => {
      error(err);
    });
  };

  const complete = () => {
    const a = listeners;

    cleanup();

    each(a, ({ complete }) => {
      complete();
    });
  };

  return {
    input: { send, error, complete },
    output
  };
};


// TODO code duplication with Event
const ref_run = function (send, error, complete) {
  send(this._value);

  this._listeners = this._listeners.insert(send);

  return () => {
    this._listeners = this._listeners.remove(send);
  };
};

// TODO code duplication with Event
export class Ref extends _Stream {
  constructor(value) {
    super(ref_run);

    this._listeners = Set();
    this._value = value;
  }

  _cleanup() {
    super._cleanup();

    this._listeners = null;
    this._value = null;
  }

  get value() {
    return this._value;
  }

  set value(value) {
    if (this._value !== value) {
      this._value = value;

      each(this._listeners, (send) => {
        send(value);
      });
    }
  }
}
