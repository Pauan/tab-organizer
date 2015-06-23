export const assert = (x) => {
  if (!x) {
    debugger;
  }
};

export const fail = () => {
  throw new Error("Failure");
};
