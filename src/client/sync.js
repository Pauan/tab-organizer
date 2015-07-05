import { uuid_port_sync } from "../common/uuid";
import { init as init_chrome } from "../chrome/client";
import { Table } from "../util/table";
import { async, async_callback } from "../util/async";
import { to_array, each } from "../util/iterator";
import { assert, fail } from "../util/assert";
import { to_json } from "../util/immutable/json";


export const init = async(function* () {
  const { ports } = yield init_chrome;

  const db = new Table();

  // TODO a little hacky
  yield async_callback((success, error) => {
    const port = ports.connect(uuid_port_sync);

    port.on_receive.listen((transaction) => {
      db.transaction((db) => {
        each(transaction, (x) => {
          console.log(to_json(x));

          const type = x.get("type");

          if (type === "init") {
            each(x.get("tables"), ([key, value]) => {
              db.add([key], value);
            });

            success(undefined);

          } else {
            // TODO a little inefficient
            const key = to_array(x.get("key"));

            if (type === "remove") {
              db.remove(key);

            } else {
              const value = x.get("value");

              if (type === "default") {
                db.default(key, value);

              } else if (type === "add") {
                db.add(key, value);

              } else if (type === "set") {
                db.set(key, value);

              } else {
                fail();
              }
            }
          }
        });
      });
    });
  });

  return db;
});
