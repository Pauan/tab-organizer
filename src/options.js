import { init as init_sync } from "./client/sync";
import { run_async } from "./util/async";

run_async(function* () {
  const db = yield init_sync;

  console["debug"]("options: initialized");
});
