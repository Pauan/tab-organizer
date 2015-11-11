import * as record from "../../util/record";
import * as timer from "../../util/timer";
import * as async from "../../util/async";
import * as console from "../../util/console";
import { chrome } from "../../common/globals";
import { async_chrome, throw_error } from "../common/util";
import { assert, crash } from "../../util/assert";


const chrome_get_all = () =>
  async_chrome((f) => {
    // TODO what about using `callback` ?
    chrome["storage"]["local"]["get"](null, f);
  });

const chrome_remove = (key) =>
  async_chrome((f) => {
    // TODO what about using `callback` ?
    chrome["storage"]["local"]["remove"](key, f);
  });

const chrome_set = (key, value) =>
  async_chrome((f) => {
    // TODO what about using `callback` ?
    chrome["storage"]["local"]["set"]({ [key]: value }, f);
  });


const duration = timer.make();

// TODO add in transaction support, so that a bug/error rolls back the transaction
export const init = async.after(chrome_get_all(), (db) => {
  const delaying = record.make();


  // TODO test this
  const _touch = (key) => {
    delay(key, 1000);

    const info = record.get(delaying, key);

    info.touched = true;
  };

  // TODO test this
  const _commit = (key) => {
    const duration = timer.make();

    if (record.has(db, key)) {
      async.run(chrome_set(key, record.get(db, key)), () => {
        timer.done(duration);

        console.debug("db.set: \"" +
                      key +
                      "\" (" +
                      timer.diff(duration) +
                      "ms)");
      });


    } else {
      async.run(chrome_remove(key), () => {
        timer.done(duration);

        console.debug("db.remove: \"" +
                      key +
                      "\" (" +
                      timer.diff(duration) +
                      "ms)");
      });
    }
  };

  // TODO test this
  const set_timer = (info, ms, key) => {
    info.ms = ms;

    info.timer = setTimeout(() => {
      assert(record.get(delaying, key) === info);

      record.remove(delaying, key);

      if (info.touched) {
        _commit(key);
      }
    }, ms);
  };

  // TODO check that the key exists in the db ?
  // TODO test this
  const delay = (key, ms) => {
    if (record.has(delaying, key)) {
      const info = record.get(delaying, key);

      // Only delay if `ms` is greater than `info.ms`
      if (ms > info.ms) {
        clearTimeout(info.timer);

        set_timer(info, ms, key);
      }

    } else {
      const info = {
        touched: false,
        ms: null,
        timer: null
      };

      set_timer(info, ms, key);

      record.insert(delaying, key, info);
    }
  };


  const OUTSIDE = 0;
  const INSIDE  = 1;
  const FAILED  = 2;

  const _transaction = {
    _state: OUTSIDE
  };

  const transaction = (f) => {
    if (_transaction._state === FAILED) {
      crash(new Error("Transaction failed"));

    } else if (_transaction._state === OUTSIDE) {
      _transaction._state = INSIDE;

      try {
        f();

      } catch (e) {
        _transaction._state = FAILED;
        throw e;
      }

      _transaction._state = OUTSIDE;

    } else {
      crash(new Error("Transaction is already running"));
    }
  };

  const check_transaction = () => {
    if (_transaction._state === FAILED) {
      crash(new Error("Cannot write: transaction failed"));

    } else if (_transaction._state === OUTSIDE) {
      crash(new Error("Cannot write: must be inside of a transaction"));
    }
  };


  // TODO maybe run this inside a transaction, so that it cannot be nested inside another transaction ?
  const modify = (key, f) => {
    check_transaction();

    record.modify(db, key, f);

    _touch(key);
  };

  // TODO is this correct ?
  const write = (key, f) => {
    check_transaction();

    f(get(key));

    _touch(key);
  };

  const include = (key, value) => {
    record.include(db, key, value);
  };

  const get = (key) =>
    record.get(db, key);

  const get_all = () =>
    db;

  // TODO test this
  // TODO how should this interact with `include` ?
  const set_all = (new_db) => {
    transaction(() => {
      // TODO is this inefficient ?
      record.each(db, (key) => {
        if (!record.has(new_db, key)) {
          // TODO this removes a key while looping over the object, does that cause any issues ?
          record.remove(db, key);
          _touch(key);
        }
      });

      // TODO is this inefficient ?
      record.each(new_db, (key, value) => {
        record.assign(db, key, value);
        _touch(key);
      });
    });
  };


  timer.done(duration);
  console.info("db: initialized (" + timer.diff(duration) + "ms)", db);

  return async.done({ modify, write, include, get, get_all, set_all, delay,
                      transaction });
});
