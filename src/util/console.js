/* @flow */
import { current_time } from "./time";


const DEBUG = false;


let time = null;

const get_time = () => {
  const old_time = time;

  time = current_time();

  if (old_time === null) {
    return 0;

  } else {
    return time - old_time;
  }
};


export const debug = (...a: Array<any>): void => {
  if (DEBUG) {
    console["debug"](get_time() + "ms ", ...a);
  }
};

export const info = (s: string, ...a: Array<any>): void => {
  console["info"](get_time() + "ms ", s, ...a);
  console["timeStamp"](s);
};

export const warn = (s: string, ...a: Array<any>): void => {
  console["warn"](get_time() + "ms ", s, ...a);
  console["timeStamp"](s);
};

export const log = (...a: Array<any>): void => {
  console["log"](get_time() + "ms ", ...a);
};
