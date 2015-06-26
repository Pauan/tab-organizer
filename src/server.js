import { init_windows } from "./server/windows";
import { run_async, concurrent } from "./util/async";

run_async(function* () {
  yield concurrent(init_windows);

  console["debug"]("SERVER STARTED");
});
