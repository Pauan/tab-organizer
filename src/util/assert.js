export const fail = (message = null) => {
  const e = (message == null
              ? new Error("Failed")
              : message);
  throw e;
};

// TODO should accept a second argument for the error message
// TODO replace some uses of fail with assert + error mesage
export const assert = (x) => {
  if (!x) {
    fail(new Error("Assertion failed"));
  }
};
