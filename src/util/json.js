import { map, each, entries } from "./iterator";
import { List } from "./immutable/list";
import { Record } from "./immutable/record";
import { fail } from "./assert";


export const to_json = (x) => {
  if (x === null ||
      x === true ||
      x === false ||
      typeof x === "number" ||
      typeof x === "string") {
    return x;

  } else if (x.to_json != null) {
    return x.to_json();

  } else {
    fail("Cannot convert to JSON: " + x);
  }
};

export const from_json = (x) => {
  if (x === null ||
      x === true ||
      x === false ||
      typeof x === "number" ||
      typeof x === "string") {
    return x;

  } else if (Array["isArray"](x)) {
    return List(map(x, from_json));

  } else if (typeof x === "object") {
    return Record(map(entries(x), ([key, value]) => [key, from_json(value)]));

  } else {
    fail("Cannot convert from JSON: " + x);
  }
};
