import { crash } from "./assert";


export const none = {
  _type: 0
};

export const some = (x) => {
  return {
    _type: 1,
    _value: x
  };
};

export const has = (x) =>
  x._type === 1;

export const get = (x) => {
  if (x._type === 1) {
    return x._value;
  } else {
    crash(new Error("Cannot get from none"));
  }
};
