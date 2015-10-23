import * as console from "./console";
import * as list from "./list";
import * as _async from "./async";


// TODO a tiny bit hacky
const performance = window["performance"];


const ms = (x) =>
  x.duration / x.iterations;


export const variance = (a) => {
  // TODO list function for this
  const a2 = list.map(a, ms);

  // TODO list function for this
  a2["sort"]((x, y) => x - y);

  return {
    fastest: list.get(a2, 0),
    slowest: list.get(a2, -1)
  };
};

// TODO this can be made into a generic list function
export const median = (a) => {
  // TODO list function for this
  const a2 = list.map(a, ms);

  // TODO list function for this
  a2["sort"]((x, y) => x - y);

  const middle = list.size(a2) / 2;

  // TODO better test for this ?
  // TODO Number.isInteger ?
  if (middle % 1 === 0) {
    return (list.get(a2, middle) +
            list.get(a2, middle - 1)) / 2;

  } else {
    return list.get(a2, Math["floor"](middle));
  }
};

// TODO this can be made into a generic list function
export const average = (a) => {
  let sum = 0;

  // TODO foldl ?
  list.each(a, (x) => {
    sum += ms(x);
  });

  return sum / list.size(a);
};

// TODO this can be made into a generic list function
export const sum = (a) => {
  let duration   = 0;
  let iterations = 0;

  // TODO foldl ?
  list.each(a, (x) => {
    duration   += x.duration;
    iterations += x.iterations;
  });

  return duration / iterations;
};


export const sync = (f) => {
  const loops    = 100;
  const duration = 100;

  const times = list.make();

  for (let i = 0; i < loops; ++i) {
    let iterations = 0;

    const start = performance["now"]();
    const done  = start + duration;

    do {
      f();
      ++iterations;
    } while (performance["now"]() < done);

    const end = performance["now"]();

    list.push(times, {
      duration: end - start,
      iterations: iterations
    });
  }

  return times;
};


// TODO more efficient implementation of this
export const async = (f) => {
  const loops    = 100;
  const duration = 100;

  const times = list.make();

  const loop2 = (iterations, done) =>
    _async.chain(f(), (_) => {
      if (performance["now"]() < done) {
        return loop2(iterations + 1, done);
      } else {
        return _async.done(iterations + 1);
      }
    });

  const loop1 = (i) => {
    if (i < loops) {
      const start = performance["now"]();
      const done  = start + duration;

      return _async.chain(loop2(0, done), (iterations) => {
        const end = performance["now"]();

        list.push(times, {
          duration: end - start,
          iterations: iterations
        });

        return loop1(i + 1);
      });

    } else {
      return _async.done(times);
    }
  };

  return loop1(0);
};


// TODO calculate the variance between lowest and highest values
export const output = (message, x) => {
  const { fastest, slowest } = variance(x);
  console.log(message +
              "\n  fastest: " + fastest +
              "\n  median:  " + median(x) +
              "\n  slowest: " + slowest +
              "\n" +
              "\n  sum:     " + sum(x) +
              "\n  average: " + average(x));
};
