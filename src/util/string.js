export const uppercase = (s) =>
  s["toLocaleUpperCase"]();

export const lowercase = (s) =>
  s["toLocaleLowerCase"]();

export const replace = (s, re, x) =>
  s["replace"](re, x);

export const match = (s, re) =>
  re["exec"](s);
