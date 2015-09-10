import * as timer from "./util/timer";
import * as async from "./util/async";
import { init as init_ui } from "./client/panel/ui";
import "./client/panel/init";

const duration = timer.make();

async.run_all([init_ui], () => {
  timer.done(duration);
  console["debug"]("panel: initialized (" + timer.diff(duration) + "ms)");
});
