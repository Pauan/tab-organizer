import { map, each, entries } from "../iterator";
import { List } from "./list";
import { Record } from "./record";


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
    throw new Error("Cannot convert to JSON: " + x);
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
    throw new Error("Cannot convert from JSON: " + x);
  }
};
