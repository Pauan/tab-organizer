import * as list from "../../../util/list";
import * as stream from "../../../util/stream";
import * as record from "../../../util/record";
import * as ref from "../../../util/ref";


// TODO this can be more efficient if it's given a starting index
export const update_groups = (groups) => {
  list.each(stream.current(groups), (group, i) => {
    record.update(group, "index", i);
  });
};

// TODO this can be more efficient if it's given a starting index
export const update_tabs = (group) => {
  list.each(stream.current(record.get(group, "tabs")), (tab, i) => {
    record.update(tab, "index", i);
  });
};

export const make_group = (id, name, tabs, info) =>
  record.make({
    "id": id,
    "info": info,
    "tabs": tabs,

    "header-name": ref.make(name),
    "selected": ref.make(false),
    "visible": ref.make(true), // TODO is this correct ?
    "height": ref.make(null),

    // TODO a little hacky
    "first-selected-tab": null,
    "index": null // TODO a little bit hacky
  });

export const make_tab = (group, tab) =>
  record.make({
    "time": record.get(tab, "time"),

    "url": ref.make(record.get(tab, "url")),
    "title": ref.make(record.get(tab, "title")),
    "favicon": ref.make(record.get(tab, "favicon")),
    "focused": ref.make(record.get(tab, "focused")),
    "unloaded": ref.make(record.get(tab, "unloaded")),

    "selected": ref.make(false),
    "visible": ref.make(true), // TODO use `matches(tab)` ?
    "animate": ref.make(false),

    "top": ref.make(null),
    "index": null, // TODO a little bit hacky
    "group": group
  });

/*export const make_group_tab = (group, tab) =>
  record.make({
    "time": record.get(tab, "time"),
    "url": record.get(tab, "url"),
    "title": record.get(tab, "title"),
    "favicon": record.get(tab, "favicon"),
    "focused": record.get(tab, "focused"),
    "unloaded": record.get(tab, "unloaded"),
    "selected": record.get(tab, "selected"),
    "visible": recrod.get(tab, "visible"),

    "top": ref.make(null),
    "index": null, // TODO a little bit hacky
    "group": group
  });*/
