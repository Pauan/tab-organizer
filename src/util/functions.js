/* @flow */

export const noop = () => {};

export const self = <A>(x: A): A => x;

export const not = (x: boolean): boolean => !x;

export const and = (...args: Array<boolean>): boolean => {
  const length = args.length;

  for (let i = 0; i < length; ++i) {
    if (!args[i]) {
      return false;
    }
  }

  return true;
};

export const or = (...args: Array<boolean>): boolean => {
  const length = args.length;

  for (let i = 0; i < length; ++i) {
    if (args[i]) {
      return true;
    }
  }

  return false;
};
