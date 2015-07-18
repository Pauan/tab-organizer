import { init as init_logic } from "./client/panel/logic";
import { run_async } from "./util/async";


run_async(function* () {
  yield init_logic;

  console["debug"]("panel: initialized");
});
