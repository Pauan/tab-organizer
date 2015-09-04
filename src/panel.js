import * as timer from "./util/timer";
import { init as init_ui } from "./client/panel/ui";
import { run_async } from "./util/async";
import "./client/panel/init";

const duration = timer.make();

run_async([init_ui], () => {
  timer.done(duration);
  console["debug"]("panel: initialized (" + timer.diff(duration) + "ms)");
});
