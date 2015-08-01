import { Ref } from "../util/mutable/ref";
import { async } from "../util/async";


export const init = async(function* () {
  const opt = (s) => new Ref(false);

  return { opt };
});
