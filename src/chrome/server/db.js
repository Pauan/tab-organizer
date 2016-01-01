import * as list from "../../util/list";
import * as record from "../../util/record";
import * as timer from "../../util/timer";
import * as async from "../../util/async";
import * as console from "../../util/console";
import { chrome } from "../../common/globals";
import { async_chrome, throw_error, callback } from "../common/util";
import { assert, crash } from "../../util/assert";


const chrome_get_all = () =>
  async_chrome((f) => {
    chrome["storage"]["local"]["get"](null, callback(f));
  });

const chrome_remove = (keys) =>
  async_chrome((f) => {
    chrome["storage"]["local"]["remove"](keys, callback(f));
  });

const chrome_set = (values) =>
  async_chrome((f) => {
    chrome["storage"]["local"]["set"](values, callback(f));
  });


const duration = timer.make();

export const init = async.after(chrome_get_all(), (db) => {
  const OUTSIDE = 0;
  const INSIDE  = 1;
  const FAILED  = 2;

  const _transaction = {
    _state: OUTSIDE,
    _keys: record.make(),
    _delay: null,
    _timer: null,
    _touched: false
  };

  const _touch = (key) => {
    record.include(_transaction._keys, key, true);
    _transaction._touched = true;
  };

  const _commit = () => {
    if (_transaction._touched && _transaction._timer === null) {
      const duration = timer.make();

      const remove = list.make();
      const update = record.make();

      let removed = false;
      let updated = false;

      record.each(_transaction._keys, (key) => {
        if (record.has(db, key)) {
          record.insert(update, key, record.get(db, key));
          updated = true;

        } else {
          list.push(remove, key);
          removed = true;
        }
      });

      if (removed) {
        const duration = timer.make();

        async.run(chrome_remove(remove), () => {
          timer.done(duration);

          console.debug("commit: remove (" +
                        timer.diff(duration) +
                        "ms)");
        });
      }

      if (updated) {
        const duration = timer.make();

        async.run(chrome_set(update), () => {
          timer.done(duration);

          console.debug("commit: write (" +
                        timer.diff(duration) +
                        "ms)");
        });
      }

      _transaction._keys = record.make();
      _transaction._touched = false;

      _transaction._timer = setTimeout(() => {
        _transaction._timer = null;

        _commit();
      }, 1000);

      timer.done(duration);

      console.debug("commit: serialize (" +
                    timer.diff(duration) +
                    "ms)");
    }
  };

  const delay = (ms) => {
    if (_transaction._delay === null) {
      if (_transaction._timer !== null) {
        clearTimeout(_transaction._timer);
      }

      _transaction._delay = ms;

      _transaction._timer = setTimeout(() => {
        _transaction._delay = null;
        _transaction._timer = null;

        _commit();
      }, ms);

    } else {
      assert(ms === _transaction._delay);
    }
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

      _commit();
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
