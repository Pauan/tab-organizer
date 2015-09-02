import * as timer from "./util/timer";
import { init as init_ui } from "./client/options/ui";
import { run_async } from "./util/async";

const duration = timer.make();

run_async([init_ui], () => {
  timer.done(duration);
  console["debug"]("options: initialized (" + timer.diff(duration) + "ms)");
});
