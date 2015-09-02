import * as maybe from "./maybe";


export const to_array = (x) =>
  Array["from"](x);

export const iterator = (x) =>
  x[Symbol["iterator"]]();

const make_iterator = (f) => {
  return {
    [Symbol["iterator"]]: f
  };
};

// TODO test this
export const empty = make_iterator(() => {
  return {
    "next": () => {
      return {
        "done": true,
        // TODO is this needed ?
        "value": undefined
      };
    }
  };
});

// TODO faster native implementation of this ?
export const entries = (o) =>
  map(Object["keys"](o), (key) => [key, o[key]]);

// TODO inefficient
export const reverse = (iter) => {
  const a = to_array(iter);

  // TODO faster version of this
  a["reverse"]();

  // TODO is this correct ?
  return iterator(a);
};

// TODO use for..of ?
export const each = (iter, f) => {
  const x = iterator(iter);

  for (;;) {
    const info = x["next"]();

    if (info["done"]) {
      break;
    } else {
      f(info["value"]);
    }
  }
};

// TODO use for..of ?
export const first = (iter, f) => {
  const x = iterator(iter);

  for (;;) {
    const info = x["next"]();

    if (info["done"]) {
      return maybe.None;

    } else if (f(info["value"])) {
      return maybe.Some(info["value"]);
    }
  }
};

export const foldl = (current, iter, f) => {
  each(iter, (x) => {
    current = f(current, x);
  });
  return current;
};

export const foldr = (current, iter, f) =>
  // TODO inefficient
  foldl(current, reverse(iter), f);

export const join = (iter, s = "") => {
  let first = true;

  return foldl("", iter, (x, y) => {
    if (first) {
      first = false;
      return x + y;

    } else {
      return x + s + y;
    }
  });
};

// TODO test this
export const keep_map = (iter, f) =>
  make_iterator(() => {
    const x = iterator(iter);

    return {
      "next": () => {
        for (;;) {
          const info = x["next"]();

          if (info["done"]) {
            return {
              "done": true,
              // TODO is this needed ?
              "value": undefined
            };

          } else {
            const x = f(info["value"]);

            if (maybe.has(x)) {
              return {
                "done": false,
                "value": maybe.get(x)
              };
            }
          }
        }
      }
    };
  });

export const keep = (iter, f) =>
  keep_map(iter, (x) =>
    (f(x)
      ? maybe.Some(x)
      : maybe.None));

export const map = (iter, f) =>
  keep_map(iter, (x) =>
    maybe.Some(f(x)));

export const any = (iter, f) =>
  maybe.has(first(iter, f));

export const all = (iter, f) =>
  !any(iter, (x) => !f(x));

export const indexed = (iter) =>
  make_iterator(() => {
    const x = iterator(iter);

    let i = 0;

    return {
      "next": () => {
        const info = x["next"]();

        if (info["done"]) {
          return {
            "done": true,
            // TODO is this needed ?
            "value": undefined
          };

        } else {
          const value = {
            "done": false,
            "value": [i, info["value"]]
          };

          ++i;

          return value;
        }
      }
    };
  });

// TODO test this
export const zip = (...iter) =>
  make_iterator(() => {
    const a = iter["map"](iterator);

    return {
      "next": () => {
        const out = new Array(a["length"]);

        for (let i = 0; i < a["length"]; ++i) {
          const x = a[i]["next"]();

          if (x["done"]) {
            return {
              "done": true,
              // TODO is this needed ?
              "value": undefined
            };

          } else {
            out[i] = x["value"];
          }
        }

        return {
          "done": false,
          "value": out
        };
      }
    };
  });

// TODO code duplication
// TODO test this
export const zip_longest = (def, ...iter) =>
  make_iterator(() => {
    const a = iter["map"](iterator);

    return {
      "next": () => {
        const out = new Array(a["length"]);

        let done = 0;

        for (let i = 0; i < a["length"]; ++i) {
          // TODO this calls the "next" method after the iterator is done
          const x = a[i]["next"]();

          if (x["done"]) {
            out[i] = def;
            ++done;

          } else {
            out[i] = x["value"];
          }
        }

        if (done === a["length"]) {
          return {
            "done": true,
            // TODO is this needed ?
            "value": undefined
          };

        } else {
          return {
            "done": false,
            "value": out
          };
        }
      }
    };
  });
