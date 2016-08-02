/* @flow */
import * as $set from "./set";
import * as $maybe from "./maybe";
import * as $running from "./running";
import { assert } from "./assert";


type Listener<A> = (_: A) => void;

type Config<A, B> = {
  start?: (_: Event<B>) => A,
  stop?: (_: Event<B>, _: A) => void
};

export type Event<A> = {
  _closed: boolean,
  _listeners: $set.Set<Listener<A>>,
  _info: Config<*, *>,
  _state: $maybe.Maybe<*>
};


export const make = <A>(info: Config<*, *> = {}): Event<A> => {
  return {
    _closed: false,
    _listeners: $set.make(),
    _info: info,
    _state: $maybe.none
  };
};

const start = <A>(event: Event<A>): void => {
  const f = event._info.start;
  if (f) {
    assert(!$maybe.has(event._state));
    event._state = $maybe.some(f(event));
  }
};

const stop = <A>(event: Event<A>): void => {
  const f = event._info.stop;
  if (f) {
    f(event, $maybe.get(event._state));
    event._state = $maybe.none;
  }
};

export const send = <A>(event: Event<A>, value: A): void => {
  if (event._closed) {
    throw new Error("Event is closed");
  }

  $set.each(event._listeners, (f) => {
    f(value);
  });
};

export const on_receive = <A>(event: Event<A>, f: Listener<A>) => {
  if (event._closed) {
    throw new Error("Event is closed");
  }

  $set.insert(event._listeners, f);

  // TODO test this
  if ($set.size(event._listeners) === 1) {
    start(event);
  }

  return $running.make(() => {
    $set.remove(event._listeners, f);

    // TODO test this
    if ($set.size(event._listeners) === 0) {
      stop(event);
    }
  });
};

export const close = <A>(event: Event<A>): void => {
  // TODO test this
  if ($set.size(event._listeners) !== 0) {
    stop(event);
  }

  event._closed = true;
};
