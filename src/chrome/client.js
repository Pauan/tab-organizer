import { async } from "../util/async";

// Exports
import * as port from "./client/port";


export const init = async(function* () {
  return {
    port
  };
});
