import { init as init_windows } from "./server/windows";
import { init as init_popup } from "./server/popup";
import { run_async } from "./util/async";
import { Timer } from "./util/time";

const timer = new Timer();

run_async(function* () {
  yield init_windows;
  yield init_popup;

  timer.done();
  console["debug"]("server: initialized (" + timer.diff() + "ms)");
});
