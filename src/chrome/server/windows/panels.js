import { chrome } from "../../../common/globals";
import { throw_error } from "../../common/util";
import { Ref, latest, throttle } from "../../../util/ref";


// TODO does this create a new panel id every time it's called ?
export const open = ({ url, left, top, width, height }) => {
  let first = true;

  const panel_id = new Ref(null);

  const info = latest([
    panel_id,
    left,
    top,
    width,
    height
  ], (id, left, top, width, height) => {
    if (first) {
      first = false;

      chrome["windows"]["create"]({
        "type": "panel",
        "url": url,
        "left": Math["round"](left),
        "top": Math["round"](top),
        "width": Math["round"](width),
        "height": Math["round"](height)
      }, (info) => {
        throw_error();
        panel_id.set(info["id"]);
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
        "left": Math["round"](left),
        "top": Math["round"](top),
        "width": Math["round"](width),
        "height": Math["round"](height)
      }, () => {
        throw_error();
      });
    }
  });

  const onRemoved = (window_id) => {
    throw_error();

    const id = panel_id.get();

    if (id !== null && id === window_id) {
      chrome["windows"]["onRemoved"]["removeListener"](onRemoved);
      run.stop();
      panel_id.set(null);
    }
  };

  chrome["windows"]["onRemoved"]["addListener"](onRemoved);
};
