import * as string from "../../../../util/string";
import * as record from "../../../../util/record";
import * as async from "../../../../util/async";
import { ports } from "../../../../chrome/client";
import { uuid_port_export } from "../../../../common/uuid";
import { category, row, button, horizontal_space } from "../common";


// TODO move this into another module ?
const download = (value, { type, name }) => {
  const blob = new Blob([value], { "type": type });
  const url = URL["createObjectURL"](blob);

  const a = document["createElement"]("a");
  a["href"] = url;
  a["download"] = name;
  a["click"]();

  URL["revokeObjectURL"](url);
};

const format = (date) =>
  date["getFullYear"]() + "-" +
  string.pad_left("00", "" + (date["getMonth"]() + 1)) + "-" +
  string.pad_left("00", "" + date["getDate"]());

export const init = async.all([], () => {
  const port = ports.open(uuid_port_export);

  const handle_events = record.make({
    "export-data": (x) => {
      const db = record.get(x, "db");

      const date = new Date();

      download(JSON["stringify"](db, null, 2), {
        type: "application/json",
        name: "Tab Organizer - User Data (" + format(date) + ").json"
      });
    }
  });

  ports.on_receive(port, (x) => {
    record.get(handle_events, record.get(x, "type"))(x);
  });


  const ui = () =>
    category("User Data", [
      row([
        button("Export...", {
          on_click: () => {
            ports.send(port, record.make({
              "type": "export"
            }));
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


  return async.done({ ui });
});
