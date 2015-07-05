import { uuid_port_sync } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { init as init_db } from "./migrate";
import { map, keep } from "../util/iterator";
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

  ports.on_connect.listen((port) => {
    if (port.name === uuid_port_sync) {
      port.send(List([Record([
        ["type", "init"],
        ["tables", Record(map(set, (s) => [s, db.get([s])]))]
      ])]));
    }
  });

  db.on_change.listen((transaction) => {
    const y1 = keep(transaction, (x) => {
      const key = x.get("key").get(0);
      return set.has(key);
    });

    const y2 = List(map(y1, (x) => x.remove("table")));

    if (y2.size > 0) {
      ports.send(uuid_port_sync, y2);
    }
  });

  return {
    sync
  };
});
