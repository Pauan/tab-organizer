import { chrome } from "../../common/globals";
import { Port } from "../common/ports";


// TODO test this
export const connect = (name) =>
  new Port(chrome["runtime"]["connect"]({ "name": name }));
