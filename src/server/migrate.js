import { init as init_chrome } from "../chrome/server";
import { async } from "../util/async";


export const init = async(function* () {
  const { db } = yield init_chrome;

  return db;
});
