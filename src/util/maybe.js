/* @flow */
import { crash } from "./assert";


type None    = { _type: 0 };
type Some<A> = { _type: 1, _value: A };

export type Maybe<A> = None | Some<A>;


export const none: None = {
  _type: 0
};

export const some = <A>(x: A): Some<A> => {
  return {
    _type: 1,
    _value: x
  };
};

export const has = <A>(x: Maybe<A>): boolean =>
  x._type === 1;

export const get = <A>(x: Maybe<A>): A => {
  if (x._type === 1) {
    return x._value;

  } else {
    return crash(new Error("Cannot get from none"));
  }
};
