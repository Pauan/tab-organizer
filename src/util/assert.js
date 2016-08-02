/* @flow */

// TODO is it more idiomatic to use message? or ?Error
export const crash = (message: ?Error) => {
  if (message == null) {
    throw (new Error("Failed") : Error);

  } else {
    throw (message: Error);
  }
};

// TODO should accept a second argument for the error message
// TODO replace some uses of crash with assert + error mesage
export const assert = (x: boolean) => {
  if (!x) {
    crash(new Error("Assertion failed"));
  }
};

// TODO this doesn't seem to work when `record.get` fails
export const on_crash = (f: (_: Error) => void): void => {
  let crashed = false;

  // TODO better typing for this
  window.addEventListener("error", (e) => {
    if (!crashed) {
      crashed = true;

      const error = e["error"];

      if (error == null) {
        // TODO non-standard
        f(new Error(e["message"], e["filename"], e["lineno"]));

      } else {
        f(error);
      }
    }
  }, true);
};
