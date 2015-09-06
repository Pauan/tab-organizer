import * as list from "../../util/list";
import { chrome } from "../../common/globals";
import { async_callback, success, error } from "../../util/async";
import { fail } from "../../util/assert";


// TODO this can be made faster if it was given an index to start at
export const update_indexes = (x) => {
  list.each(x, (x, index) => {
    x.index = index;
  });
};

export const round = (x) =>
  (x == null
    ? undefined
    : Math["round"](x));


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
  async_callback((out) => {
    f((...value) => {
      const err = check_error();
      if (err === null) {
        if (value["length"] === 1) {
          success(out, value[0]);
        } else {
          success(out, value);
        }
      } else {
        error(out, err);
      }
    });
  });
