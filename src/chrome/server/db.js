import { chrome } from "../../common/globals";
import { Timer } from "../../util/time";
import { Set } from "../../util/mutable/set";
import { Record } from "../../util/immutable/record";
import { Table } from "../../util/table";
import { to_json, from_json } from "../../util/immutable/json";
import { async, run_async } from "../../util/async";
import { async_chrome } from "../common/util";
import { assert, fail } from "../../util/assert";
import { each, entries } from "../../util/iterator";


let delaying = Record();

const with_delay = (key, f) => {
  if (delaying.has(key)) {
    delaying.get(key).thunk = f;
  } else {
    f();
  }
};


const transients = new Set();

class DB extends Table {
  // TODO check that the key exists in the db ?
  delay(key, ms) {
    if (delaying.has(key)) {
      const info = delaying.get(key);

      // Only delay if `ms` is greater than `info.ms`
      if (ms <= info.ms) {
        return;
      }
    }

    const o = {
      thunk: null,
      ms: ms
    };

    delaying = delaying.assign(key, o);

    setTimeout(() => {
      // TODO is this correct ?
      if (delaying.get(key) === o) {
        delaying = delaying.remove(key);
      }

      o.thunk();
    }, ms);
  }

  transient(key, value) {
    transients.insert(key);
    this.insert([key], value);
  }
}


export const init = async(function* () {
  const db = new DB();

  const timer = new Timer();

  db.set_all(from_json(yield async_chrome((callback) => {
    chrome["storage"]["local"]["get"](null, callback);
  })));

  timer.done();


  db.on_commit((transaction) => {
    each(transaction, (x) => {
      const type = x.get("type");

      if (type === "default") {
        // Do nothing

      } else {
        const keys = x.get("keys");
        const key  = keys.get(0);

        if (!transients.has(key)) {
          // TODO this doesn't seem like quite the right spot for this, but I don't know any better spots...
          db.delay(key, 1000);


          // TODO test this
          if (type === "remove" && keys.size === 1) {
            with_delay(key, () => {
              run_async(function* () {
                const timer = new Timer();

                yield async_chrome((callback) => {
                  chrome["storage"]["local"]["remove"](key, callback);
                });

                timer.done();

                console["debug"]("db.remove: \"" +
                                 key +
                                 "\" (" +
                                 timer.diff() +
                                 "ms)");
              });
            });


          } else {
            const table = x.get("table");
            const value = table.get(key);

            with_delay(key, () => {
              run_async(function* () {
                const timer_serialize = new Timer();
                const s_value = to_json(value);
                timer_serialize.done();

                const timer = new Timer();

                yield async_chrome((callback) => {
                  chrome["storage"]["local"]["set"]({ [key]: s_value }, callback);
                });

                timer.done();

                console["debug"]("db.set: \"" +
                                 key +
                                 "\" (serialize " +
                                 timer_serialize.diff() +
                                 "ms) (commit " +
                                 timer.diff() +
                                 "ms)");
              });
            });
          }
        }
      }
    });
  });

  console["debug"]("db: initialized (" + timer.diff() + "ms)", to_json(db.get_all()));

  return db;
});
