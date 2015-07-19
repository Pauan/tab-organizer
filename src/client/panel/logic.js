import { init as init_sync } from "../sync";
import { async } from "../../util/async";
import { get_sorted, remove_sorted,
         insert_sorted, insert } from "../../util/immutable/array"; // TODO hacky
import { assert } from "../../util/assert";
import { Record } from "../../util/immutable/record";
import { List } from "../../util/immutable/list";
import { Ref } from "../../util/stream";
import { each } from "../../util/iterator";
import { current_time, difference, round_to_hour } from "../../util/time";
import { tab as ui_tab } from "./ui/tab";
import { group as ui_group } from "./ui/group";
import { group_list as ui_group_list } from "./ui/group-list";
import * as dom from "../dom";


// TODO hacky
const group_list = ui_group_list();

dom.main.push(group_list);


let group_ids = Record();
let tab_ids   = Record();
let groups    = [];


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
    ["unloaded", new Ref(!transients.has(id))],
    ["ui", new Ref(null)]
  ]);

  tab_ids = tab_ids.insert(id, x);
};


// TODO move this to another module
const pluralize = (x, s) => {
  if (x === 1) {
    return x + s;
  } else {
    return x + s + "s";
  }
};

const diff_to_text = (diff) => {
  if (diff.day === 0) {
    if (diff.hour === 0) {
      return "Less than an hour ago";
    } else {
      return pluralize(diff.hour, " hour") + " ago";
    }
  } else {
    // TODO is this correct ?
    const hours = diff.hour - (diff.day * 24);
    return pluralize(diff.day, " day") + " " + pluralize(hours, " hour") + " ago";
  }
};

const get_groups = new Ref((tab) => {
  const now = round_to_hour(current_time());
  const id  = round_to_hour(tab.get("time").get("created"));
  return [
    Record([
      ["id", "" + id],
      ["name", diff_to_text(difference(now, id))],
      ["sort", (group1, group2) => {
        return group2.get("id") - group1.get("id");
      }]
    ])
  ];
});

/*const get_groups = new Ref((tab) => {
  const title = tab.get("title").value;
  return [title ? title[0] : ""];
});*/

/*const sort_tab = new Ref((tab1, tab2) => {
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
});*/

const sort_group = new Ref();

const sort_tab = new Ref((tab1, tab2) => {
  return tab2.get("time").get("created") -
         tab1.get("time").get("created");
});

const add_group = (x, f) => {
  const id = x.get("id");

  if (group_ids.has(id)) {
    return group_ids.modify(id, f);

  } else {
    const x2 = x.insert("tabs", [])
                .insert("selected", new Ref([]))
                .insert("ui", new Ref(null));

    const ui = ui_group(x2, true);

    x2.get("ui").value = ui;

    const { index, value } = get_sorted(groups, x2, x2.get("sort"));

    assert(!value.has());

    groups = insert(groups, index, x2);
    group_list.insert(index, ui.get("top"));

    return group_ids.insert(id, f(x2));
  }
};

// TODO test this
export const select_tab = (group, tab) => {
  const group_selected = group.get("selected");
  const selected = tab.get("selected");

  if (selected.value) {
    selected.value = false;
    group_selected.value = remove_sorted(group_selected.value, tab, sort_tab.value);

  } else {
    selected.value = true;
    group_selected.value = insert_sorted(group_selected.value, tab, sort_tab.value);
  }
};

/*export const deselect_tab = (group, tab) => {
  const group_selected = group.get("selected");
  const selected = tab.get("selected");

  selected.value = false;
  group_selected.value = remove_sorted(group_selected.value, tab, sort_tab.value);
};*/

const add_tab_to_group = (x, tab) => {
  group_ids = add_group(x, (group) =>
    group.modify("tabs", (tabs) => {
      const ui = ui_tab(group, tab, true);

      tab.get("ui").value = ui;

      const { index, value } = get_sorted(tabs, tab, sort_tab.value);

      assert(!value.has());

      group.get("ui").value.get("tabs").insert(index, ui);

      return insert(tabs, index, tab);
    }));
};

const add_tab = (tab) => {
  each(get_groups.value(tab), (x) => {
    add_tab_to_group(x, tab);
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
