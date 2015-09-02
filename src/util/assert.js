import * as ref from "./ref";


export const failed = ref.make(null);


// TODO this should accept an Error object rather than a string
export const fail = (message = null) => {
  const e = (message == null
              ? new Error("Failed")
              : message);
  ref.set(failed, e);
  throw e;
};

export const assert = (x) => {
  if (!x) {
    fail(new Error("Assertion failed"));
  }
};
