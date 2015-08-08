import { Ref } from "./mutable/ref";


export const failed = new Ref(null);


export const assert = (x) => {
  if (!x) {
    const e = new Error("Assertion failed");
    failed.set(e);
    throw e;
  }
};

export const fail = () => {
  const e = new Error("Failed");
  failed.set(e);
  throw e;
};
