import { crash } from "./assert";
import { current_time } from "./time";


export const make = () => {
  return {
    _start: current_time(),
    _end: null
  };
};

export const done = (timer) => {
  timer._end = current_time();
};

export const diff = (timer) => {
  if (timer._end === null) {
    crash(new Error("Timer is not done yet"));

  } else {
    return timer._end - timer._start;
  }
};
