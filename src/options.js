import { init as init_ui } from "./client/options/ui";
import { run_async } from "./util/async";
import { Timer } from "./util/time";

const timer = new Timer();

run_async([init_ui], () => {
  timer.done();
  console["debug"]("options: initialized (" + timer.diff() + "ms)");
});
