import { chrome } from "../../common/globals";
import { Event } from "../../util/event";
import { async_chrome } from "../common/util";


export const on_click = new Event();

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


chrome["browserAction"]["onClicked"]["addListener"](() => {
  on_click.send(undefined);
});
