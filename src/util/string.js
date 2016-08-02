/* @flow */
import * as $array from "./array";


export const pad_left = (pad: string, s: string): string => {
  if (s.length >= pad.length) {
    return s;

  } else {
    return pad.slice(0, pad.length - s.length) + s;
  }
};

export const pad_right = (s: string, pad: string): string => {
  if (s.length >= pad.length) {
    return s;

  } else {
    return s + pad.slice(s.length, pad.length);
  }
};

export const uppercase = (s: string): string =>
  s.toLocaleUpperCase();

export const lowercase = (s: string): string =>
  s.toLocaleLowerCase();

export const replace = (s: string, re: RegExp, x: string) =>
  s.replace(re, x);

export const match = (s: string, re: RegExp): ?Array<string> =>
  re.exec(s);

export const test = (s: string, re: RegExp): boolean =>
  re.test(s);

export const split = (s: string, re: RegExp): Array<string> =>
  s.split(re);

export const plural = (x: number, s: string): string => {
  if (x === 1) {
    return x + s;
  } else {
    return x + s + "s";
  }
};

// TODO test this
// TODO better implementation, with error checking
export const slice = (x: string, from: number, to: number): string =>
  x.slice(from, to);


export const sort = (x: string, y: string): $array.Order => {
  const i = x.localeCompare(y);

  if (i === 0) {
    return 0;

  } else if (i < 1) {
    return -1;

  } else {
    return 1;
  }
};
