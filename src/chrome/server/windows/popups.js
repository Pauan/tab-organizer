import * as record from "../../../util/record";
import * as event from "../../../util/event";
import { chrome } from "../../../common/globals";
import { throw_error, round } from "../../common/util";
import { assert } from "../../../util/assert";


export const on_close = event.make();

const popup_ids = record.make();


export const make_popup = (info, events) => {
  const type = info["type"];

  if (type === "popup" || type === "panel") {
    const popup = make(info);

    record.insert(popup_ids, popup.id, popup);
  }
};


export const remove_popup = (id) => {
  if (record.has(popup_ids, id)) {
    const popup = record.get(popup_ids, id);

    assert(popup.id === id);

    record.remove(popup_ids, popup.id);

    event.send(on_close, popup);
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

const make = (info) => {
  return {
    id: info["id"]
  };
};

export const focus = (popup) => {
  update_popup(popup, { "focused": true });
};

export const close = (popup) => {
  chrome["windows"]["remove"](popup.id, () => {
    throw_error();
  });
};

export const move = (popup, { left, top, width, height }) => {
  update_popup(popup, {
    "state": "normal",
    "left": round(left),
    "top": round(top),
    "width": round(width),
    "height": round(height)
  });
};

export const maximize = (popup) => {
  update_popup(popup, { "state": "maximized" });
};

export const get_size = (popup, f) => {
  get_popup(popup, (info) => {
    f({
      left: info["left"],
      top: info["top"],
      width: info["width"],
      height: info["height"],
    });
  });
};


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
    f(record.get(popup_ids, info["id"]));
  });
};
