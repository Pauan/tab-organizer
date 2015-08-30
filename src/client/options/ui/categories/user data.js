import * as dom from "../../../dom";
import { async } from "../../../../util/async";
import { category, row, button, horizontal_space } from "../common";


export const init = async([], () => {

  const ui = () =>
    category("User Data", [
      row([
        button("Export...", {
          on_click: () => {

          }
        }),

        horizontal_space("10px"),

        button("Import...", {
          on_click: () => {

          }
        }),

        horizontal_space("25px"),

        button("Reset options to default...", {
          on_click: () => {

          }
        })
      ])
    ]);


  return { ui };
});
