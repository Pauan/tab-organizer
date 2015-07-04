import { chrome } from "../../common/globals";
import { Timer } from "../../util/time";
import { Record } from "../../util/immutable/record";
import { Table } from "../../util/table";
import { to_json, from_json } from "../../util/immutable/json";
import { async, run_async } from "../../util/async";
import { async_chrome } from "../common/util";
import { assert } from "../../util/assert";
import { each, entries } from "../../util/iterator";


let delaying = Record();

const with_delay = (key, f) => {
  if (delaying.has(key)) {
    delaying.get(key).thunk = f;
  } else {
    f();
  }
};


class DB extends Table {
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

    if (delaying.has(key)) {
      delaying = delaying.set(key, o);
    } else {
      delaying = delaying.add(key, o);
    }

    setTimeout(() => {
      // TODO is this correct ?
      if (delaying.get(key) === o) {
        delaying = delaying.remove(key);
      }

      // TODO is this correct ?
      o.thunk();
    }, ms);
  }
}


export const init = async(function* () {
  const db = new DB();

  const timer = new Timer();

  db.set_all(from_json(yield async_chrome((callback) => {
    chrome["storage"]["local"]["get"](null, callback);
  })));

  timer.done();


  // TODO this is a little hacky
  let setting = async(function* () {});


  db.on_change.listen((x) => {
    each(x, (x) => {
      const type = x.get("type");

      if (type === "default") {
        console.log("default", x.get("key"));


      } else if (type === "set" || type === "add") {
        const key   = x.get("key");
        const value = x.get("value");

        with_delay(key, () => {
          run_async(function* () {
            // TODO is this correct ?
            yield setting;

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


      } else if (type === "remove") {
        const key = x.get("key");

        with_delay(key, () => {
          run_async(function* () {
            // TODO is this correct ?
            yield setting;

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


      // TODO is this correct ?
      } else if (type === "set_all") {
        const value = x.get("value");

        setting = async(function* () {
          try {
            // TODO is this correct ?
            // TODO is it possible to have race conditions ?
            yield setting;

            yield async_chrome((callback) => {
              chrome["storage"]["local"]["clear"](callback);
            });

            yield async_chrome((callback) => {
              chrome["storage"]["local"]["set"](to_json(value), callback);
            });

          } finally {
            setting = async(function* () {});
          }
        });


      } else {
        fail();
      }
    });
  });

  console["debug"]("db: initialized (" + timer.diff() + "ms)", to_json(db.get_all()));

  return db;
});
