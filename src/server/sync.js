import { uuid_port_sync } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { keep_map, map } from "../util/iterator";
import { None, Some } from "../util/immutable/maybe";
import { Set } from "../util/mutable/set";
import { List } from "../util/immutable/list";
import { Record } from "../util/immutable/record";
import { async } from "../util/async";


export const init = async(function* () {
  const db = yield init_db;
  const { ports } = yield init_chrome;

  const set = new Set();

  const sync = (s) => {
    set.add(s);
  };

  const transactions = db.on_commit.keep_map((transaction) => {
    const x = List(keep_map(transaction, (x) => {
      const key = x.get("keys").get(0);

      if (set.has(key)) {
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

  ports.on_connect(uuid_port_sync).each((port) => {
    port.send(Record([
      ["type", "init"],
      ["tables", Record(map(set, (s) => [s, db.get([s])]))]
    ]));

    // TODO a little hacky
    const x = transactions.finally(() => { y.stop(); }).each((transaction) => {
      port.send(Record([
        ["type", "transaction"],
        ["value", transaction]
      ]));
    });

    // TODO a little hacky
    // When the port closes, stop iterating over `transactions`
    const y = port.on_receive.finally(() => { x.stop(); }).drain();
  });

  return {
    sync
  };
});
