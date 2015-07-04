import { uuid_port_tab } from "./common/uuid";
import { init as init_chrome } from "./chrome/client";
import { run_async } from "./util/async";

run_async(function* () {
  const { ports } = yield init_chrome;

  const x = ports.connect(uuid_port_tab);

  let i = 0;
  let start = null;

  x.on_receive.listen((message) => {
    if (i === 0) {
      start = Date.now();

    } else if (i === 4999) {
      console.log(Date.now() - start);
    }

    ++i;
  });

  console["debug"]("options: initialized");
});
