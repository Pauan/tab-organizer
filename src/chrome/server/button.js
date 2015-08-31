import { chrome } from "../../common/globals";
import { Event } from "../../util/event";
import { assert } from "../../util/assert";
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


export const set_tooltip = (ref) =>
  ref.each((x) => {
    assert(x === null || typeof x === "string");
    assert(x !== "");

    if (x === null) {
      x = " ";
    }

    chrome["browserAction"]["setTitle"]({ "title": x });
  });

export const set_bubble_url = (ref) =>
  ref.each((x) => {
    assert(x === null || typeof x === "string");
    assert(x !== "");

    if (x === null) {
      x = "";
    }

    chrome["browserAction"]["setPopup"]({ "popup": x });
  });

export const set_text = (ref) =>
  ref.each((x) => {
    assert(x === null || typeof x === "string");
    assert(x !== "");

    if (x === null) {
      x = "";
    }

    chrome["browserAction"]["setBadgeText"]({ "text": x });
  });

export const set_color = (ref) =>
  ref.each((x) => {
    const { red, green, blue, alpha } = x;

    assert(typeof red === "number");
    assert(typeof green === "number");
    assert(typeof blue === "number");
    assert(typeof alpha === "number");

    chrome["browserAction"]["setBadgeBackgroundColor"]({
      // TODO is it necessary to round the alpha ?
      "color": [red, green, blue, Math["round"](alpha * 255)]
    });
  });
