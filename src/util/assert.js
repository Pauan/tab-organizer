export const crash = (message = null) => {
  const e = (message == null
              ? new Error("Failed")
              : message);
  throw e;
};

// TODO should accept a second argument for the error message
// TODO replace some uses of crash with assert + error mesage
export const assert = (x) => {
  if (!x) {
    crash(new Error("Assertion failed"));
  }
};

// TODO this doesn't seem to work when `record.get` fails
export const on_crash = (f) => {
  let crashed = false;

  addEventListener("error", (e) => {
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
