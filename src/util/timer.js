/* @flow */
import { crash } from "./assert";
import { current_time } from "./time";
import type { Time } from "./time";


export type Timer = {
  _start: Time,
  _end: ?Time
};

export const make = () => {
  return {
    _start: current_time(),
    _end: null
  };
};

export const done = (timer: Timer): void => {
  timer._end = current_time();
};

export const diff = (timer: Timer): Time => {
  if (timer._end == null) {
    return crash(new Error("Timer is not done yet"));

  } else {
    return timer._end - timer._start;
  }
};
