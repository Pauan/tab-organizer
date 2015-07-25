import { chrome } from "../../common/globals";
import { Event } from "../../util/event";
import { throw_error } from "../common/util";


// TODO test this
const _on_click = Event({
  start: (e) => {
    const onClicked = () => {
      throw_error();

      e.send(undefined);
    };

    chrome["browserAction"]["onClicked"]["addListener"](onClicked);

    return { onClicked };
  },
  stop: (e, { onClicked }) => {
    chrome["browserAction"]["onClicked"]["removeListener"](onClicked);
  }
});

export const on_click = _on_click.receive;


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
