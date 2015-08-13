import { Ref } from "./mutable/ref";


export const failed = new Ref(null);


// TODO this should accept an Error object rather than a string
export const fail = (message = null) => {
  const e = (message == null
              ? new Error("Failed")
              : message);
  failed.set(e);
  throw e;
};

export const assert = (x) => {
  if (!x) {
    fail(new Error("Assertion failed"));
  }
};
