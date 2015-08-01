import { init as init_logic } from "./client/panel/logic";
import { run_async } from "./util/async";
import { Timer } from "./util/time";

const timer = new Timer();

run_async(function* () {
  yield init_logic;

  timer.done();
  console["debug"]("panel: initialized (" + timer.diff() + "ms)");
});
