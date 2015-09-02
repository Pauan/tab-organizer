export const noop = () => {};

export const self = (x) => x;

export const not = (x) => !x;

export const and = (...args) => {
  for (let i = 0; i < args["length"]; ++i) {
    if (!args[i]) {
      return false;
    }
  }

  return true;
};

export const or = (...args) => {
  for (let i = 0; i < args["length"]; ++i) {
    if (args[i]) {
      return true;
    }
  }

  return false;
};
