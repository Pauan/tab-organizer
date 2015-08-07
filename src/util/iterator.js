import { Some, None } from "./immutable/maybe";


/*
// TODO is this correct ?
// TODO maybe use yield* instead ?
export const iterator = (x) =>
  x[Symbol["iterator"]]();

export const empty = {
  [Symbol["iterator"]]: () => {
    return {
      "next": () => {
        return {
          "done": true
        };
      };
    };
  };
};*/

export const to_array = (x) =>
  Array["from"](x);

// TODO test this
export const empty = {
  [Symbol["iterator"]]: () => {
    return {
      "next": () => {
        return { "done": true };
      }
    };
  }
};

export const iterator = (x) => x[Symbol["iterator"]]();

export const entries = (o) =>
  map(Object["keys"](o), (key) => [key, o[key]]);

// TODO inefficient
export const reverse = (iter) => {
  const a = to_array(iter);

  // TODO faster version of this
  a["reverse"]();

  return iterator(a);
};

export const each = (iter, f) => {
  for (let x of iter) {
    f(x);
  }
};

export const first = (iter, f) => {
  for (let x of iter) {
    if (f(x)) {
      return Some(x);
    }
  }

  return None;
};

export const foldl = (current, iter, f) => {
  for (let x of iter) {
    current = f(current, x);
  }
  return current;
};

export const foldr = (current, iter, f) =>
  // TODO inefficient
  foldl(current, reverse(iter), f);

export const join = (iter, s = "") => {
  let first = true;

  let out = "";

  for (let x of iter) {
    if (first) {
      first = false;
      out = out + x;

    } else {
      out = out + s + x;
    }
  }

  return out;
};

export const keep_map = function* (iter, f) {
  for (let x of iter) {
    const maybe = f(x);
    if (maybe.has()) {
      yield maybe.get();
    }
  }
};

export const keep = (iter, f) =>
  keep_map(iter, (x) => (f(x) ? Some(x) : None));

export const map = (iter, f) =>
  keep_map(iter, (x) => Some(f(x)));

export const any = (iter, f) =>
  first(iter, f).has();

export const all = (iter, f) =>
  !any(iter, (x) => !f(x));

export const indexed = function* (iter) {
  let i = 0;

  for (let x of iter) {
    yield [i, x];
    ++i;
  }
};

export const zip = (...iter) => {
  return {
    [Symbol["iterator"]]: () => {
      const a = iter["map"](iterator);

      return {
        "next": () => {
          const out = new Array(a["length"]);

          for (let i = 0; i < a["length"]; ++i) {
            const x = a[i]["next"]();
            if (x["done"]) {
              return { "done": true };
            } else {
              out[i] = x["value"];
            }
          }

          return { "done": false, "value": out };
        }
      };
    }
  };
};

// TODO code duplication
export const zip_longest = (def, ...iter) => {
  return {
    [Symbol["iterator"]]: () => {
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
            return { "done": true };
          } else {
            return { "done": false, "value": out };
          }
        }
      };
    }
  };
};
