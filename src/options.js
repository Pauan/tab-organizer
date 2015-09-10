import * as timer from "./util/timer";
import * as async from "./util/async";
import { init as init_ui } from "./client/options/ui";

const duration = timer.make();

async.run_all([init_ui], () => {
  timer.done(duration);
  console["debug"]("options: initialized (" + timer.diff(duration) + "ms)");
});
