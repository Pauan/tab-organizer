import { Cache } from "../../util/cache";
import { Port } from "../common/port";


const _ports = new Cache();

export const connect = (name) =>
  _ports.get(name, () => {
    const port = new Port(chrome["runtime"]["connect"]({ "name": name }));

    port.on_disconnect(() => {
      _ports.remove(name);
    });

    return port;
  });
