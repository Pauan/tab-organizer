import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { each, entries } from "../util/iterator";
import { Event } from "../util/event";
import { Record } from "../util/mutable/record";
import { Ref } from "../util/mutable/ref";
import { async } from "../util/async";


export const make_options = (uuid, default_options) =>
  async(function* () {
    const db = yield init_db;
    const { ports } = yield init_chrome;


    const events = Event();


    const current_options = {};
    const options = new Record();

    each(entries(default_options), ([key, value]) => {
      const x = new Ref(value);

      options.insert(key, x);

      // TODO handle stop somehow ?
      x.each((value) => {
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
    });


    const get = (s) =>
      options.get(s);


    ports.on_connect(uuid, (port) => {
      port.send({
        "type": "init",
        "default": default_options,
        "current": current_options
      });

      const x = events.receive((x) => {
        port.send(x);
      });

      // When the port closes, stop listening for `tab_events`
      port.on_disconnect(() => {
        x.stop();
      });
    });


    return { get };
  });
