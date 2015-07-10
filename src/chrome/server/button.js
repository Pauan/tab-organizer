import { chrome } from "../../common/globals";
import { Stream } from "../../util/stream";
import { async_chrome, check_error } from "../common/util";


// TODO test this
export const on_click = new Stream((send, error, complete) => {
  const onClicked = () => {
    const err = check_error();

    if (err === null) {
      send(undefined);

    } else {
      cleanup();
      error(err);
    }
  };

  // TODO test this
  const cleanup = () => {
    chrome["browserAction"]["onClicked"]["removeListener"](onClicked);
  };

  chrome["browserAction"]["onClicked"]["addListener"](onClicked);

  return cleanup;
});

export const set_tooltip = (x) => {
  if (x == null || x === "") {
    x = " ";
  }
  chrome["browserAction"]["setTitle"]({ "title": x });
};

export const set_bubble_url = (x) => {
  if (x == null) {
    x = "";
  }
  chrome["browserAction"]["setPopup"]({ "popup": x });
};

export const set_text = (x) => {
  if (x == null) {
    x = "";
  }
  chrome["browserAction"]["setBadgeText"]({ "text": x });
};

export const set_color = (r, g, b, a) => {
  chrome["browserAction"]["setBadgeBackgroundColor"]({
    // TODO is it necessary to round the alpha ?
    "color": [r, g, b, Math["round"](a * 255)]
  });
};
