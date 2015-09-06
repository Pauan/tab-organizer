import * as record from "../../util/record";
import * as timer from "../../util/timer";
import { chrome } from "../../common/globals";
import { async } from "../../util/async";
import { async_chrome, throw_error } from "../common/util";
import { each, entries } from "../../util/iterator";
import { assert } from "../../util/assert";


const chrome_get_all = () =>
  async_chrome((callback) => {
    chrome["storage"]["local"]["get"](null, callback);
  });

const chrome_remove = (key, f) => {
  chrome["storage"]["local"]["remove"](key, () => {
    throw_error();
    f();
  });
};

const chrome_set = (key, value, f) => {
  chrome["storage"]["local"]["set"]({ [key]: value }, () => {
    throw_error();
    f();
  });
};


const duration = timer.make();

export const init = async([chrome_get_all()], (db) => {
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
      chrome_set(key, record.get(db, key), () => {
        timer.done(duration);

        console["debug"]("db.set: \"" +
                         key +
                         "\" (" +
                         timer.diff(duration) +
                         "ms)");
      });


    } else {
      chrome_remove(key, () => {
        timer.done(duration);

        console["debug"]("db.remove: \"" +
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


  const modify = (key, f) => {
    record.modify(db, key, f);

    _touch(key);
  };

  // TODO is this correct ?
  const write = (key, f) => {
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
    // TODO is this inefficient ?
    each(entries(db), ([key]) => {
      if (!record.has(new_db, key)) {
        // TODO this removes a key while looping over the object, does that cause any issues ?
        record.remove(db, key);
        _touch(key);
      }
    });

    // TODO is this inefficient ?
    each(entries(new_db), ([key, value]) => {
      record.assign(db, key, value);
      _touch(key);
    });
  };


  timer.done(duration);
  console["debug"]("db: initialized (" + timer.diff(duration) + "ms)", db);

  return { modify, write, include, get, get_all, set_all, delay };
});
