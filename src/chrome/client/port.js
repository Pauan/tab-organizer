import { chrome } from "../../common/globals";
import { Cache } from "../../util/mutable/cache";
import { Port } from "../common/port";


const _ports = new Cache();

// TODO test this
export const connect = (name) =>
  _ports.get(name, () => {
    const port = new Port(chrome["runtime"]["connect"]({ "name": name }));

    port.on_disconnect.listen(() => {
      _ports.remove(name);
    });

    return port;
  });
