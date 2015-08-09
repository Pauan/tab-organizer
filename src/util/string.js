export const uppercase = (s) =>
  s["toLocaleUpperCase"]();

export const lowercase = (s) =>
  s["toLocaleLowerCase"]();

export const replace = (s, re, x) =>
  s["replace"](re, x);

export const match = (s, re) =>
  re["exec"](s);

export const plural = (x, s) => {
  if (x === 1) {
    return x + s;
  } else {
    return x + s + "s";
  }
};
