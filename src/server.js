import * as timer from "./util/time";
import { init as init_windows } from "./server/windows";
import { init as init_popup } from "./server/popup";
import { init as init_cache } from "./server/cache";
import { init as init_options } from "./server/options";
import { init as init_counter } from "./server/counter";
import { run_async } from "./util/async";

const duration = timer.make();

run_async([init_windows,
           init_popup,
           init_cache,
           init_options,
           init_counter], () => {
  timer.done(duration);
  console["debug"]("server: initialized (" + timer.diff(duration) + "ms)");
});
