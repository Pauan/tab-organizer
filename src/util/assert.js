import { Ref } from "./mutable/ref";


export const failed = new Ref(false);


export const assert = (x) => {
  if (!x) {
    failed.set(true);
    throw new Error("Assertion failed");
  }
};

export const fail = () => {
  failed.set(true);
  throw new Error("Failed");
};
