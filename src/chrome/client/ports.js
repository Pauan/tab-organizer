import { chrome } from "../../common/globals";
import { make } from "../common/ports";
import { send, on_receive, on_close } from "../common/ports";
export { send, on_receive, on_close } from "../common/ports";


// TODO test this
export const open = (name) =>
  make(chrome["runtime"]["connect"]({ "name": name }));
