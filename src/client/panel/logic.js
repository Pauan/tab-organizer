import { init as init_sync } from "../sync";
import { async } from "../../util/async";
import { get_sorted, insert } from "../../util/immutable/array"; // TODO hacky
import { assert } from "../../util/assert";
import { Record } from "../../util/immutable/record";
import { List } from "../../util/immutable/list";
import { Ref } from "../../util/stream";
import { each } from "../../util/iterator";
import { tab as ui_tab } from "./ui/tab";
import { group as ui_group } from "./ui/group";
import * as dom from "../dom";


let group_ids = Record();
let tab_ids   = Record();
let groups    = List();


const open_tab = (db, tab) => {
  const transients = db.get(["transient.tab-ids"]);

  const id = tab.get("id");

  const x = Record([
    ["id", id],
    ["time", tab.get("time")],
    ["window", new Ref(tab.get("window"))],
    ["url", new Ref(tab.get("url"))],
    ["title", new Ref(tab.get("title") || tab.get("url") || "")],
    ["favicon", new Ref(tab.get("favicon"))],
    ["focused", new Ref(transients.has(id) && transients.get(id).get("focused"))],
    ["selected", new Ref(false)],
    ["unloaded", new Ref(!transients.has(id))]
  ]);

  tab_ids = tab_ids.insert(id, x);
};

const get_groups = new Ref((tab) => {
  const title = tab.get("title").value;
  return [title ? title[0] : ""];
});

const sort_tab = new Ref((tab1, tab2) => {
  const title1 = tab1.get("title").value;
  const title2 = tab2.get("title").value;

  if (title1 === title2) {
    return tab1.get("time").get("created") -
           tab2.get("time").get("created");

  } else if (title1 < title2) {
    return -1;
  } else {
    return 1;
  }
});

const add_group = (id, f) => {
  if (group_ids.has(id)) {
    return group_ids.modify(id, f);

  } else {
    const x = Record([
      ["id", id],
      ["tabs", []]
    ]);

    const ui = ui_group(x, true);

    dom.main.push(ui);

    return group_ids.insert(id, f(x.insert("ui", ui)));
  }
};

const add_tab_to_group = (group_id, tab) => {
  group_ids = add_group(group_id, (group) =>
    group.modify("tabs", (tabs) => {
      const { index, value } = get_sorted(tabs, tab, sort_tab.value);

      if (value.has()) {
        console.log(tabs[index], value.get());
      }
      assert(!value.has());

      const ui = ui_tab(tab, true);

      group.get("ui").insert(index, ui);

      return insert(tabs, index, tab.insert("ui", ui));
    }));
};

const add_tab = (tab) => {
  each(get_groups.value(tab), (id) => {
    add_tab_to_group(id, tab);
  });
};

export const init = async(function* () {
  const db = yield init_sync;

  each(db.get(["current.tab-ids"]), ([key, tab]) => {
    open_tab(db, tab);
  });

  each(tab_ids, ([key, tab]) => {
    add_tab(tab);
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
