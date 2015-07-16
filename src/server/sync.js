import { uuid_port_sync } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { keep_map, map } from "../util/iterator";
import { None, Some } from "../util/immutable/maybe";
import { Set } from "../util/mutable/set";
import { List } from "../util/immutable/list";
import { Record } from "../util/immutable/record";
import { race } from "../util/stream";
import { async } from "../util/async";


export const init = async(function* () {
  const db = yield init_db;
  const { ports } = yield init_chrome;

  const keys = new Set();

  // TODO test this
  const transactions = db.on_commit.keep_map((transaction) => {
    const x = List(keep_map(transaction, (x) => {
      const key = x.get("keys").get(0);

      // TODO test this
      if (keys.has(key)) {
        return Some(x.remove("table"));
      } else {
        return None;
      }
    }));

    if (x.size > 0) {
      return Some(x);
    } else {
      return None;
    }
  });

  const sync = (key) => {
    // This ensures that there aren't any duplicate keys
    keys.insert(key);
  };

  ports.on_connect(uuid_port_sync).each((port) => {
    port.send(Record([
      ["type", "init"],
      ["tables", Record(map(keys, (key) => [key, db.get([key])]))]
    ]));

    // TODO test this
    race([
      transactions.map((transaction) => {
        port.send(Record([
          ["type", "transaction"],
          ["value", transaction]
        ]));
      }),
      // When the port closes, stop iterating over `transactions`
      port.on_receive
    ]).run();
  });

  return {
    sync
  };
});
