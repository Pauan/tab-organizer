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

    port.on_receive.each((x) => {
      const type = x.get("type");

      if (type === "init") {
        db.set_all(x.get("tables"));
        success(undefined);

      } else if (type === "transaction") {
        db.commit_transaction(x.get("value"));

      } else {
        fail();
      }
    });
  });

  return db;
});
