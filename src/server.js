import * as timer from "./util/timer";
import * as async from "./util/async";
import * as console from "./util/console";
import { on_crash } from "./util/assert";
import { init as init_windows } from "./server/windows";
import { init as init_popup } from "./server/popup";
import { init as init_options } from "./server/options";
import { init as init_counter } from "./server/counter";


on_crash((e) => {
  alert(e["stack"]);
});


const duration = timer.make();

async.run_all([init_windows,
               init_popup,
               init_options,
               init_counter], () => {
  timer.done(duration);
  console.info("server: initialized (" + timer.diff(duration) + "ms)");
});
