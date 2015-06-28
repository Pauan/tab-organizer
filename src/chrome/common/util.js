import { async_callback } from "../../util/async";
import { each } from "../../util/iterator";


// TODO this can be made faster if it was given an index to start at
export const update_indexes = (list) => {
  let i = 0;

  each(list, (x) => {
    x.index = i;
    ++i;
  });
};

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
    throw err;
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
