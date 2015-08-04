import { init as init_tabs } from "../../sync/tabs";
import { async } from "../../../util/async";
import { SortedList } from "../../../util/mutable/list";
import { Set } from "../../../util/mutable/set";
import { Record } from "../../../util/mutable/record";
import { Ref } from "../../../util/mutable/ref";
import { each } from "../../../util/iterator";
import { search, value } from "../search/search";
import { difference, round_to_hour, current_time } from "../../../util/time";


const sort_group = (x, y) =>
  y.get("time") - x.get("time");

const sort_tab = (x, y) =>
  y.get("time").get("created") -
  x.get("time").get("created");

// TODO move this to another module
const pluralize = (x, s) => {
  if (x === 1) {
    return x + s;
  } else {
    return x + s + "s";
  }
};

// TODO test this
const diff_to_text = ({ year, week, day, hour }) => {
  if (year === 0 && week === 0 && day === 0 && hour === 0) {
    return "Less than an hour ago";

  } else {
    const out = [];

    if (year > 0) {
      out["push"](pluralize(year, " year"));
    }

    if (week > 0) {
      out["push"](pluralize(week, " week"));
    }

    if (day > 0) {
      out["push"](pluralize(day, " day"));
    }

    if (hour > 0) {
      out["push"](pluralize(hour, " hour"));
    }

    return out["join"](" ") + " ago";
  }
};

const get_group_name = (time) =>
  diff_to_text(difference(round_to_hour(current_time()), time));

// TODO code duplication
const make_group = (id, time) =>
  new Record({
    "id": id,
    "time": time,

    // Standard properties
    "tabs": new SortedList(sort_tab),
    "header-name": new Ref(get_group_name(time)),
    "focused": new Ref(false),
    // TODO a little hacky
    "first-selected-tab": null,
    "matches": new Ref(false), // TODO is this correct ?
    "height": new Ref(null)
  });

// TODO code duplication
const make_tab = (group, tab) =>
  new Record({
    "id": tab.get("id"),
    "group": group,
    "time": tab.get("time"),

    // Standard properties
    "url": new Ref(tab.get("url")),
    "title": new Ref(tab.get("title")),
    "favicon": new Ref(tab.get("favicon")),

    "focused": new Ref(tab.get("focused")),
    "unloaded": new Ref(tab.get("unloaded")),

    "matches": new Ref(false), // TODO use `matches(tab)` ?
    "selected": new Ref(false),
    "visible": new Ref(true),
    "animate": new Ref(false),
    "top": new Ref(null)
  });


export const init = async(function* () {
  const { windows, on_change } = yield init_tabs;

  const make = () => {
    const groups = new SortedList(sort_group);
    const group_ids = new Record();
    const tab_ids = new Record();


    const get_group = (tab) => {
      const time = round_to_hour(tab.get("time").get("created"));
      const id = "" + time;

      if (group_ids.has(id)) {
        return group_ids.get(id);

      } else {
        const group = make_group(id, time);

        group_ids.insert(id, group);

        groups.insert(group);

        return group;
      }
    };


    const new_tab = (group, tab) => {
      const x = make_tab(group, tab);

      tab_ids.insert(x.get("id"), x);

      return x;
    };


    const types = {
      "tab-open": ({ tab }) => {
        const group = get_group(tab);
        const x = new_tab(group, tab);

        group.get("tabs").insert(x);

        search(groups);
      },


      "tab-focus": () => {},
      "tab-unfocus": () => {},


      // TODO code duplication
      "tab-update": ({ tab }) => {
        const x = tab_ids.get(tab.get("id"));

        x.get("url").set(tab.get("url"));
        x.get("title").set(tab.get("title"));
        x.get("favicon").set(tab.get("favicon"));

        search(groups);
      },


      "tab-move": () => {},


      "tab-close": ({ tab }) => {
        const x = tab_ids.get(tab.get("id"));
        const group = x.get("group");
        const tabs = group.get("tabs");

        x.update("group", null);
        tab_ids.remove(x.get("id"));
        tabs.remove(x);

        if (tabs.size === 0) {
          group_ids.remove(group.get("id"));
          groups.remove(group);
        }

        // TODO is this needed ?
        search(groups);
      },


      "window-open": () => {},
      "window-close": () => {}
    };


    const stop1 = on_change((x) => {
      types[x.type](x);
    });

    const stop2 = value.on_change(() => {
      search(groups);
    });


    each(windows, (window) => {
      // TODO code duplication with "tab-open"
      each(window.get("tabs"), (tab) => {
        const group = get_group(tab);
        const x = new_tab(group, tab);

        group.get("tabs").insert(x);
      });
    });

    search(groups);


    // TODO test this
    const stop = () => {
      stop1.stop();
      stop2.stop();
    };

    return { groups, stop };
  };


  return { make };
});
