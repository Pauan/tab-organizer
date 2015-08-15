import { chrome } from "../../../common/globals";
import { async_chrome, dimensions } from "../../common/util";


class Panel {
  constructor(info) {
    this.id = info["id"];
  }
}

// TODO does this create a new panel id every time it's called ?
export const open = (info) =>
  async_chrome((callback) => {
    const o = dimensions(info);

    o["url"] = info.url;
    o["type"] = "panel";

    chrome["windows"]["create"](o, (panel) => {
      // TODO test this
      callback(new Panel(panel));
    });
  });
