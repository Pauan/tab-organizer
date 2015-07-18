import { init as init_sync } from "../sync";
import { async } from "../../util/async";
import { Record } from "../../util/immutable/record";
import { List } from "../../util/immutable/list";
import { Ref } from "../../util/stream";
import { each } from "../../util/iterator";
import { tab as ui_tab } from "./ui/tab";
import * as dom from "../dom";


let group_ids = Record();
let tab_ids   = Record();
let groups    = List();

const open_tab = (tab) => {
  tab_ids = tab_ids.insert(tab.get("id"), Record([
    ["id", tab.get("id")],
    ["url", new Ref(tab.get("url"))],
    ["title", new Ref(tab.get("title"))],
    ["favicon", new Ref(tab.get("favicon"))],
    ["focused", new Ref(false)],
    ["selected", new Ref(false)],
    ["unloaded", new Ref(true)]
  ]));
};

export const init = async(function* () {
  const db = yield init_sync;

  each(db.get(["current.tab-ids"]), ([key, tab]) => {
    open_tab(tab);
  });

  each(db.get(["transient.tab-ids"]), ([key, info]) => {
    const tab = tab_ids.get(key);

    tab.get("focused").value = info.get("focused");
    tab.get("unloaded").value = false;
  });

  each(tab_ids, ([key, tab]) => {
    dom.main.push(ui_tab(tab, true));
  });

  /*db.on_commit.each((transaction) => {
    each(transaction, (x) => {
      switch (x.get("type")) {
      case "tab-open":
        const tab = x.get("tab");



        break;

      default:
        fail();
      }
    });
  });*/
});
