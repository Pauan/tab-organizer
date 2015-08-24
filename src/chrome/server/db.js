import { chrome } from "../../common/globals";
import { Timer } from "../../util/time";
import { Set } from "../../util/mutable/set";
import { Record } from "../../util/immutable/record";
import { Table } from "../../util/table";
import { to_json, from_json } from "../../util/json";
import { async, run_async } from "../../util/async";
import { async_chrome } from "../common/util";
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

    // TODO hacky, this should be a part of Transaction or something
    this.transaction((db) => {
      db.insert([key], value);
    });
  }
}


const chrome_get_all = () =>
  async_chrome((callback) => {
    chrome["storage"]["local"]["get"](null, callback);
  });

const chrome_remove = (key) =>
  async_chrome((callback) => {
    chrome["storage"]["local"]["remove"](key, callback);
  });

const chrome_set = (key, value) =>
  async_chrome((callback) => {
    chrome["storage"]["local"]["set"]({ [key]: value }, callback);
  });


export const init = async([chrome_get_all()], (chrome_json) => {
  const db = new DB();

  const timer = new Timer();

  const json = from_json(chrome_json);

  db.transaction((db) => {
    db.set_all(json);
  });

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
              const timer = new Timer();

              // TODO a tiny bit hacky
              run_async([chrome_remove(key)], () => {
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
              const timer_serialize = new Timer();
              const s_value = to_json(value);
              timer_serialize.done();

              const timer = new Timer();

              // TODO a tiny bit hacky
              run_async([chrome_set(key, s_value)], () => {
                timer.done();

                /*console["debug"]("db.set: \"" +
                                 key +
                                 "\" (serialize " +
                                 timer_serialize.diff() +
                                 "ms) (commit " +
                                 timer.diff() +
                                 "ms)");*/
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
