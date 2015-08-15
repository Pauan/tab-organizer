import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { each, entries } from "../util/iterator";
import { Event } from "../util/event";
import { Record } from "../util/mutable/record";
import { Ref } from "../util/ref";
import { async } from "../util/async";
import { fail } from "../util/assert";


export const make_options = (uuid, default_options) =>
  async([init_db,
         init_chrome],
        (db,
         { ports }) => {

    const events = Event();


    const current_options = {};
    const options = new Record();

    const make_ref = ([key, value]) => {
      const x = new Ref(value);

      options.insert(key, x);

      // TODO handle stop somehow ?
      x.on_change((value) => {
        if (value === default_options[key]) {
          delete current_options[key];

        } else {
          current_options[key] = value;
        }

        events.send({
          "type": "set",
          "key": key,
          "value": value
        });
      });
    };


    each(entries(default_options), make_ref);


    const get = (s) =>
      options.get(s);


    const handle_event = {
      "set": ({ "key":   key,
                "value": value }) => {
        // TODO this shouldn't send out a message to the port that made the change
        get(key).set(value);
      }
    };


    ports.on_connect(uuid, (port) => {
      port.send({
        "type": "init",
        "default": default_options,
        "current": current_options
      });

      const x = events.receive((x) => {
        port.send(x);
      });

      // TODO code duplication
      port.on_receive((x) => {
        const type = x["type"];
        if (handle_event[type]) {
          handle_event[type](x);
        } else {
          fail();
        }
      });

      // When the port closes, stop listening for `events`
      // TODO test this
      port.on_disconnect(() => {
        x.stop();
      });
    });


    return { get };
  });
