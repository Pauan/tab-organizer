import * as event from "../util/event";
import * as running from "../util/running";
import * as record from "../util/record";
import * as ref from "../util/ref";
import * as async from "../util/async";
import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { fail } from "../util/assert";


export const make_options = (uuid, db_name, default_options) =>
  async.all([init_db,
             init_chrome],
            (db,
             { ports }) => {

    db.include(db_name, record.make());


    const events = event.make();

    const refs = record.make();


    const current_options = db.get(db_name);

    record.each(default_options, (key, default_value) => {
      // TODO what if the default and the current are the same ?
      const x = ref.make(record.get_default(current_options, key, () =>
                           default_value));

      record.insert(refs, key, x);

      // TODO handle stop somehow ?
      ref.on_change(x, (value) => {
        db.write(db_name, (current_options) => {
          // TODO test this
          if (value === default_value) {
            // TODO use `exclude` instead ?
            record.remove(current_options, key);

          } else {
            record.assign(current_options, key, value);
          }
        });

        event.send(events, record.make({
          "type": "set",
          "key": key,
          "value": value
        }));
      });
    });


    const get = (s) =>
      record.get(refs, s);


    const handle_event = record.make({
      "set": (port, x) => {
        const key   = record.get(x, "key");
        const value = record.get(x, "value");
        // TODO this shouldn't send out a message to the port that made the change
        ref.set(get(key), value);
      }
    });


    ports.on_open(uuid, (port) => {
      ports.send(port, record.make({
        "type": "init",
        "default": default_options,
        "current": db.get(db_name)
      }));

      const x = event.on_receive(events, (x) => {
        ports.send(port, x);
      });

      ports.on_receive(port, (x) => {
        record.get(handle_event, record.get(x, "type"))(port, x);
      });

      // When the port closes, stop listening for `events`
      // TODO test this
      ports.on_close(port, () => {
        running.stop(x);
      });
    });


    return async.done({ get });
  });
