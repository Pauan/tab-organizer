import { init as init_ui } from "./client/panel/ui";
import { run_async } from "./util/async";
import { Timer } from "./util/time";

const timer = new Timer();

run_async(function* () {
  yield init_ui;

  timer.done();
  console["debug"]("panel: initialized (" + timer.diff() + "ms)");
});
