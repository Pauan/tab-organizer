import { init as init_chrome } from "./chrome/client";
import { init as init_sync } from "./client/sync";
import { run_async } from "./util/async";

run_async(function* () {
  const { ports } = yield init_chrome;
  const db = yield init_sync;

  console["debug"]("options: initialized");
});
