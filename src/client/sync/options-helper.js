import { ports } from "../../chrome/client";
import { Record } from "../../util/mutable/record";
import { each, entries } from "../../util/iterator";
import { fail } from "../../util/assert";
import { Ref } from "../../util/mutable/ref";
import { async, async_callback } from "../../util/async";


export const make_options = (uuid) =>
  async(function* () {
    const options = new Record();

    const get = (s) =>
      options.get(s);


    yield async_callback((success, error) => {
      const port = ports.connect(uuid);

      const types = {
        "init": ({ "default": _default,
                   "current": _current }) => {

          each(entries(_default), ([key, value]) => {
            const x = new Ref(value);

            options.insert(key, x);
          });

          each(entries(_current), ([key, value]) => {
            get(key).set(value);
          });

          success(undefined);
        },

        // TODO
        /*"set": () => {
        }*/
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

    return { get };
  });
