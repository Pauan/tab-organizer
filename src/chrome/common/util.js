import { chrome } from "../../common/globals";
import { async_callback } from "../../util/async";
import { each, indexed } from "../../util/iterator";
import { fail } from "../../util/assert";


// TODO this can be made faster if it was given an index to start at
export const update_indexes = (list) => {
  each(indexed(list), ([index, x]) => {
    x.index = index;
  });
};

export const round = (x) =>
  (x == null
    ? undefined
    : Math["round"](x));

export const dimensions = (info) => {
  const o = {};

  if (info.left != null) {
    o["left"] = info.left;
  }
  if (info.top != null) {
    o["top"] = info.top;
  }
  if (info.width != null) {
    o["width"] = info.width;
  }
  if (info.height != null) {
    o["height"] = info.height;
  }

  return o;
};


// TODO test this
export const check_error = () => {
  if (chrome["runtime"]["lastError"] != null) {
    return new Error(chrome["runtime"]["lastError"]["message"]);
  } else {
    return null;
  }
};

export const throw_error = () => {
  const err = check_error();
  if (err !== null) {
    fail(err);
  }
};

export const async_chrome = (f) =>
  async_callback((success, error) => {
    f((...value) => {
      const err = check_error();
      if (err === null) {
        if (value["length"] === 1) {
          success(value[0]);
        } else {
          success(value);
        }
      } else {
        error(err);
      }
    });
  });
