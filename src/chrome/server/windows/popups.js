import { chrome } from "../../../common/globals";
import { throw_error } from "../../common/util";
import { Event } from "../../../util/event";
import { EmptyRef } from "../../../util/ref";
import { Dict } from "../../../util/mutable/dict";
import { assert } from "../../../util/assert";


const _on_close = Event();

export const on_close = _on_close.receive;

const popup_ids = new Dict();


export const make_popup = (info, events) => {};


export const remove_popup = (id) => {
  if (popup_ids.has(id)) {
    const popup = popup_ids.get(id);

    assert(popup._id.get() === id);

    popup._close();

    _on_close.send(popup);
  }
};


export const focus_popup = (id) => {};


class Popup {
  constructor({ type = "popup",
                url,
                left = null,
                top = null,
                width = null,
                height = null }) {

    this._id = new EmptyRef();

    chrome["windows"]["create"]({
      "type": type,
      "url": url,
      "left": (left == null ? null : Math["round"](left)),
      "top": (top == null ? null : Math["round"](top)),
      "width": (width == null ? null : Math["round"](width)),
      "height": (height == null ? null : Math["round"](height))
    }, (info) => {
      throw_error();

      this._open(info["id"]);
    });
  }

  _open(id) {
    popup_ids.insert(id, this);
    this._id.set(id);
  }

  _close() {
    // TODO additional cleanup ?
    this._id = null;
  }

  close() {
    this._id.wait((id) => {
      chrome["windows"]["remove"](id, () => {
        throw_error();
      });
    });
  }

  focus() {
    this._id.wait((id) => {
      chrome["windows"]["update"](id, { "focused": true }, () => {
        throw_error();
      });
    });
  }

  move({ left, top, width, height }) {
    this._id.wait((id) => {
      chrome["windows"]["update"](id, {
        "left": (left == null ? null : Math["round"](left)),
        "top": (top == null ? null : Math["round"](top)),
        "width": (width == null ? null : Math["round"](width)),
        "height": (height == null ? null : Math["round"](height))
      }, () => {
        throw_error();
      });
    });
  }
}


export const open = (info) =>
  new Popup(info);
