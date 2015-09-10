import * as async from "../util/async";

// Exports
import { init as init_db } from "./server/db";
import { init as init_windows } from "./server/windows";
import { manifest } from "./common/manifest";
import * as ports from "./server/ports";
import * as button from "./server/button";


export const init = async.all([init_db,
                               init_windows],
                              (db,
                               { windows, tabs, popups }) => {
  return async.done({
    db,
    windows,
    tabs,
    popups,
    ports,
    button,
    manifest
  });
});
