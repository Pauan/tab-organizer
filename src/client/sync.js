import { uuid_port_sync } from "../common/uuid";
import { init as init_chrome } from "../chrome/server";
import { Table } from "../util/table";
import { async, async_callback } from "../util/async";
import { assert, fail } from "../util/assert";


export const init = async(function* () {
  const { ports } = yield init_chrome;

  const port = ports.connect(uuid_port_sync);

  // TODO a little hacky
  const db = yield async_callback((success, error) => {
    // TODO a little hacky
    let table = null;

    port.on_receive.listen((message) => {
      const type = message.get("type");

      if (type === "init") {
        assert(table === null);
        table = new Table(message.get("tables"));
        success(table);

      } else if (type === "default") {
        table.default(message.get("key"), message.get("value"));

      } else if (type === "add") {
        table.add(message.get("key"), message.get("value"));

      } else if (type === "set") {
        table.set(message.get("key"), message.get("value"));

      } else if (type === "remove") {
        table.remove(message.get("key"));

      } else {
        fail();
      }
    });
  });

  return {
    db
  };
});
