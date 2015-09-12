import * as async from "../../util/async";
import * as record from "../../util/record";
import * as ref from "../../util/ref";
import { ports } from "../../chrome/client";
import { fail } from "../../util/assert";


// TODO rather than syncing with the background page, maybe instead use `chrome.storage.local` ?
export const make_options = (uuid) => {
  const out = async.make();

  const port = ports.open(uuid);

  const options = record.make();

  const get = (s) =>
    record.get(options, s);

  const types = record.make({
    "init": (info) => {
      const current  = record.get(info, "current");
      const defaults = record.get(info, "default");

      const make_ref = (key, value) => {
        // TODO use `options.default` somehow ?
        if (!record.has(options, key)) {
          const x = ref.make(value);

          record.insert(options, key, x);

          // TODO test this
          ref.on_change(x, (value) => {
            ports.send(port, record.make({
              "type": "set",
              "key": key,
              "value": value
            }));
          });
        }
      };

      record.each(current,  make_ref);
      record.each(defaults, make_ref);

      const get_default = (s) =>
        record.get(defaults, s);

      async.success(out, { get, get_default });
    },

    "set": (info) => {
      // TODO this shouldn't send out a message
      ref.set(get(record.get(info, "key")), record.get(info, "value"));
    }
  });

  ports.on_receive(port, (x) => {
    record.get(types, record.get(x, "type"))(x);
  });

  return out;
};
