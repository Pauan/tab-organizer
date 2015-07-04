import { async } from "../util/async";

// Exports
import { init as init_db } from "./server/db";
import { init as init_windows } from "./server/windows";
import { manifest } from "./server/manifest";
import * as port from "./server/port";
import * as button from "./server/button";


export const init = async(function* () {
  const db = yield init_db;
  const { windows, tabs, popups, panels } = yield init_windows;

  return {
    db,
    windows,
    tabs,
    popups,
    port,
    button,
    panels,
    manifest
  };
});
