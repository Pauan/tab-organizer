import { chrome } from "../../../common/globals";
import { throw_error, round } from "../../common/util";
import { Event } from "../../../util/event";
import { Dict } from "../../../util/mutable/dict";
import { assert } from "../../../util/assert";


const _on_close = Event();

export const on_close = _on_close.receive;

const popup_ids = new Dict();


export const make_popup = (info, events) => {
  const type = info["type"];

  if (type === "popup" || type === "panel") {
    const popup = new Popup(info);

    popup_ids.insert(popup.id, popup);
  }
};


export const remove_popup = (id) => {
  if (popup_ids.has(id)) {
    const popup = popup_ids.get(id);

    assert(popup.id === id);

    popup_ids.remove(popup.id);

    _on_close.send(popup);
  }
};


export const focus_popup = (id) => {};


const update_popup = (popup, info) => {
  chrome["windows"]["update"](popup.id, info, () => {
    throw_error();
  });
};

const get_popup = (popup, f) => {
  chrome["windows"]["get"](popup.id, { "populate": false }, f);
};

export class Popup {
  constructor(info) {
    this.id = info["id"];
  }

  focus() {
    update_popup(this, { "focused": true });
  }

  close() {
    chrome["windows"]["remove"](this.id, () => {
      throw_error();
    });
  }

  move({ left, top, width, height }) {
    update_popup(this, {
      "state": "normal",
      "left": round(left),
      "top": round(top),
      "width": round(width),
      "height": round(height)
    });
  }

  maximize() {
    update_popup(this, { "state": "maximized" });
  }

  get_size(f) {
    get_popup(this, (info) => {
      f({
        left: info["left"],
        top: info["top"],
        width: info["width"],
        height: info["height"],
      });
    });
  }
}


export const open = ({ type = "popup",
                       focused = true,
                       url,
                       left = null,
                       top = null,
                       width = null,
                       height = null }, f) => {
  chrome["windows"]["create"]({
    "type": type,
    "url": url,
    "focused": focused,
    "left": round(left),
    "top": round(top),
    "width": round(width),
    "height": round(height)
  }, (info) => {
    throw_error();
    f(popup_ids.get(info["id"]));
  });
};
