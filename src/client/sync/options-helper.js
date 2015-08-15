import { ports } from "../../chrome/client";
import { Record } from "../../util/mutable/record";
import { each, entries } from "../../util/iterator";
import { fail } from "../../util/assert";
import { Ref } from "../../util/ref";
import { async_callback } from "../../util/async";


export const make_options = (uuid) =>
  async_callback((success, error) => {
    const port = ports.connect(uuid);

    const options = new Record();

    const get = (s) =>
      options.get(s);

    const types = {
      "init": ({ "default": _default,
                 "current": _current }) => {

        const make_ref = ([key, value]) => {
          // TODO use `options.default` somehow ?
          if (!options.has(key)) {
            const x = new Ref(value);

            options.insert(key, x);

            x.on_change((value) => {
              port.send({
                "type": "set",
                "key": key,
                "value": value
              });
            });
          }
        };

        each(entries(_current), make_ref);
        each(entries(_default), make_ref);

        const defaults = new Record(_default);

        const get_default = (s) =>
          defaults.get(s);

        success({ get, get_default });
      },

      "set": ({ "key":   key,
                "value": value }) => {
        // TODO this shouldn't send out a message
        get(key).set(value);
      }
    };

    port.on_receive((x) => {
      types[x["type"]](x);
    });
  });
