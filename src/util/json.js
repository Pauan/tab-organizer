import { map, each, entries } from "./iterator";
import { ImmutableList } from "./mutable/list";
import { ImmutableRecord } from "./mutable/record";
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
    return new ImmutableList(map(x, from_json));

  } else if (typeof x === "object") {
    const o = {};

    // TODO inefficient ?
    each(entries(x), ([key, value]) => {
      o[key] = from_json(value);
    });

    return new ImmutableRecord(o);

  } else {
    fail("Cannot convert from JSON: " + x);
  }
};
