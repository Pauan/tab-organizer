import { init as init_windows } from "./server/windows";
import { run_async, concurrent } from "./util/async";
import { Timer } from "./util/time";

const timer = new Timer();

run_async(function* () {
  yield concurrent(init_windows);

  timer.done();
  console["debug"]("server: initialized (" + timer.diff() + "ms)");
});
