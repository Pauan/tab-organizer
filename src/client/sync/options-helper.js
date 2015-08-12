import { ports } from "../../chrome/client";
import { Record } from "../../util/mutable/record";
import { each, entries } from "../../util/iterator";
import { fail } from "../../util/assert";
import { Ref } from "../../util/mutable/ref";
import { async, async_callback } from "../../util/async";


export const make_options = (uuid) =>
  async(function* () {
    const options = new Record();


    const defaults = yield async_callback((success, error) => {
      const port = ports.connect(uuid);

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

          success(new Record(_default));
        },

        "set": ({ "key":   key,
                  "value": value }) => {
          // TODO this shouldn't send out a message
          get(key).set(value);
        }
      };

      // TODO code duplication
      port.on_receive((x) => {
        const type = x["type"];
        if (types[type]) {
          types[type](x);
        } else {
          fail();
        }
      });
    });


    const get = (s) =>
      options.get(s);

    const get_default = (s) =>
      defaults.get(s);


    return { get, get_default };
  });
