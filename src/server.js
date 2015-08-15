import { init as init_windows } from "./server/windows";
import { init as init_popup } from "./server/popup";
import { init as init_cache } from "./server/cache";
import { init as init_options } from "./server/options";
import { run_async } from "./util/async";
import { Timer } from "./util/time";

const timer = new Timer();

run_async([init_windows,
           init_popup,
           init_cache,
           init_options], () => {
  timer.done();
  console["debug"]("server: initialized (" + timer.diff() + "ms)");
});
