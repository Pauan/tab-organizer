import { uuid_port_sync } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { keep_map, map } from "../util/iterator";
import { None, Some } from "../util/immutable/maybe";
import { Cache } from "../util/mutable/cache";
import { List } from "../util/immutable/list";
import { Record } from "../util/immutable/record";
import { Event } from "../util/stream";
import { async } from "../util/async";


export const init = async(function* () {
  const db = yield init_db;
  const { ports } = yield init_chrome;

  let keys = Record();

  const dbs = new Cache();

  // TODO handle completion in some way ?
  const transactions = new Event();

  const handle_transaction = (transaction) => {
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
      transactions.send(x);
    }
  };

  const sync = (db, key) => {
    // This ensures that there aren't any duplicate keys
    keys = keys.insert(key, db);

    // TODO test this
    // If we listen to the same db multiple times, it will trigger duplicate
    // events. So we use a cache to make sure that we listen to each db
    // exactly once.
    // TODO should this maybe cache `db.on_commit` instead ?
    dbs.get(db, () => {
      // TODO handle completion in some way ?
      db.on_commit.each(handle_transaction);
    });
  };

  ports.on_connect(uuid_port_sync).each((port) => {
    port.send(Record([
      ["type", "init"],
      ["tables", Record(map(keys, ([key, db]) => [key, db.get([key])]))]
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
