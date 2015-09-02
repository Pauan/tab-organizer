import { fail } from "./assert";
import { remove as _remove } from "./array";
export { size } from "./array";


export const make = () =>
  [];

export const has = (array, value) =>
  array["indexOf"](value) !== -1;

export const insert = (array, value) => {
  const index = array["indexOf"](value);

  if (index === -1) {
    array["push"](value);

  } else {
    fail(new Error("Value already exists in set: " + value));
  }
};

export const remove = (array, value) => {
  const index = array["indexOf"](value);

  if (index === -1) {
    fail(new Error("Value does not exist in set: " + value));

  } else {
    _remove(array, index);
  }
};
