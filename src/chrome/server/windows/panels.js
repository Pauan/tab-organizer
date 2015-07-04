import { chrome } from "../../../common/globals";
import { async, ignore } from "../../../util/async";
import { async_chrome, dimensions } from "../../common/util";
import { assert } from "../../../util/assert";


class Panel {
  constructor(info) {
    this.id = info["id"];
  }
}

export const open = (info) => async(function* () {
  // TODO does this create a new panel id every time it's called ?
  const panel = yield async_chrome((callback) => {
    const o = dimensions(info);

    o["url"] = info.url;
    o["type"] = "panel";

    chrome["windows"]["create"](o, callback);
  });

  return new Panel(panel);
});
