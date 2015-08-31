const is_object = (x) =>
  Object["getPrototypeOf"](x) === Object["prototype"];


export const is_json = (x) => {
  if (x === null ||
      x === true ||
      x === false ||
      typeof x === "number" ||
      typeof x === "string") {
    return true;


  } else if (Array["isArray"](x)) {
    for (let i = 0; i < x["length"]; ++i) {
      if (!is_json(x[i])) {
        return false;
      }
    }

    return true;


  } else if (is_object(x)) {
    // TODO is this inefficient ?
    // TODO what about hasOwnProperty check ?
    for (let key in x) {
      if (!is_json(x[key])) {
        return false;
      }
    }

    return true;


  } else {
    return false;
  }
};
