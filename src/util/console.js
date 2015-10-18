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


export const debug = (...a) => {
  if (DEBUG) {
    console["debug"](get_time() + "ms ", ...a);
  }
};

export const info = (s, ...a) => {
  console["info"](get_time() + "ms ", s, ...a);
  console["timeStamp"](s);
};

export const warn = (s, ...a) => {
  console["warn"](get_time() + "ms ", s, ...a);
  console["timeStamp"](s);
};

export const log = (...a) => {
  console["log"](get_time() + "ms ", ...a);
};
