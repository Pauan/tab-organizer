import * as event from "../util/event";
import * as running from "../util/running";
import * as record from "../util/record";
import * as ref from "../util/ref";
import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { async } from "../util/async";
import { fail } from "../util/assert";


export const make_options = (uuid, default_options) =>
  async([init_db,
         init_chrome],
        (db,
         { ports }) => {

    const events          = event.make();

    const current_options = record.make();
    const refs            = record.make();

    const make_ref = (key, value) => {
      const x = ref.make(value);

      record.insert(refs, key, x);

      // TODO handle stop somehow ?
      ref.on_change(x, (value) => {
        if (value === record.get(default_options, key)) {
          // TODO use `exclude` instead ?
          record.remove(current_options, key);

        } else {
          record.assign(current_options, key, value);
        }

        event.send(events, record.make({
          "type": "set",
          "key": key,
          "value": value
        }));
      });
    };


    record.each(default_options, make_ref);


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
        "current": current_options
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


    return { get };
  });
