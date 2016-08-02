/* @flow */
import * as $functions from "./functions";
import { crash } from "./assert";


export type Runner =
  { _running: boolean, _stop: () => void };


export const make = (f: () => void): Runner => {
  return {
    _running: true,
    _stop: f
  };
};

export const stop = (runner: Runner): void => {
  if (runner._running) {
    const _stop = runner._stop;
    runner._running = false;
    runner._stop = $functions.noop;
    _stop();

  } else {
    crash(new Error("Runner is already stopped!"));
  }
};

export const noop = (): Runner =>
  make($functions.noop);
