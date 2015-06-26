export const assert = (x) => {
  if (!x) {
    throw new Error("Assertion failed");
  }
};

export const fail = () => {
  throw new Error("Failed");
};
