import { crash } from "./assert";


export const none = [];

export const some = (x) => [x];

export const has = (x) =>
  x["length"] === 1;

export const get = (x) => {
  if (x["length"] === 1) {
    return x[0];
  } else {
    crash(new Error("Cannot get from none"));
  }
};
