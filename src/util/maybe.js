import { fail } from "./assert";


export const None = [];

export const Some = (x) => [x];

export const has = (x) =>
  x["length"] !== 0;

export const get = (x) => {
  if (x["length"]) {
    return x[0];
  } else {
    fail(new Error("Cannot get from None"));
  }
};
