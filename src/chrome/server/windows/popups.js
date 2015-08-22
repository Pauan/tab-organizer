import { chrome } from "../../../common/globals";
import { throw_error } from "../../common/util";
import { Ref, latest, throttle, always } from "../../../util/ref";


export const make_popup = (info, events) => {};

export const remove_popup = (id) => {};

export const focus_popup = (id) => {};


export const open = ({ type = "popup",
                       url,
                       left = always(null),
                       top = always(null),
                       width = always(null),
                       height = always(null) }) => {
  let first = true;

  const popup_id = new Ref(null);

  const info = latest([
    popup_id,
    left,
    top,
    width,
    height
  ], (id, left, top, width, height) => {
    if (first) {
      first = false;

      chrome["windows"]["create"]({
        "type": type,
        "url": url,
        "left": (left == null ? null : Math["round"](left)),
        "top": (top == null ? null : Math["round"](top)),
        "width": (width == null ? null : Math["round"](width)),
        "height": (height == null ? null : Math["round"](height))
      }, (info) => {
        throw_error();
        popup_id.set(info["id"]);
      });
    }

    return { id, left, top, width, height };
  });

  // TODO is `throttle` a good idea ?
  const run = throttle(info, 300).each(({
    id,
    left,
    top,
    width,
    height
  }) => {
    if (id !== null) {
      chrome["windows"]["update"](id, {
        "left": (left == null ? null : Math["round"](left)),
        "top": (top == null ? null : Math["round"](top)),
        "width": (width == null ? null : Math["round"](width)),
        "height": (height == null ? null : Math["round"](height))
      }, () => {
        throw_error();
      });
    }
  });

  const onRemoved = (window_id) => {
    throw_error();

    const id = popup_id.get();

    if (id !== null && id === window_id) {
      chrome["windows"]["onRemoved"]["removeListener"](onRemoved);
      run.stop();
      popup_id.set(null);
    }
  };

  chrome["windows"]["onRemoved"]["addListener"](onRemoved);
};
