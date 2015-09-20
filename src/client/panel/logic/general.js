import * as list from "../../../util/list";
import * as stream from "../../../util/stream";
import * as record from "../../../util/record";
import * as ref from "../../../util/ref";
import { uppercase } from "../../../util/string";


export const get_created = (tab) =>
  record.get(record.get(tab, "time"), "created");

export const get_title = (tab) => {
  const title = ref.get(record.get(tab, "title"));

  if (title === null) {
    return "";

  } else {
    return uppercase(title);
  }
};


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
    "name": name,
    "tabs": tabs,
    "info": info,

    "selected": ref.make(false),
    "visible": ref.make(true), // TODO is this correct ?
    "height": ref.make(null),

    "index": null, // TODO a little bit hacky
    // TODO a little hacky
    "first-selected-tab": null
  });

// TODO utility function for this ?
// TODO test this
const copy = (from, to, key) => {
  if (record.has(from, key)) {
    record.insert(to, key, record.get(from, key));
  }
};

// TODO test this
const make_time = (time) => {
  const out = record.make({
    "created": record.get(time, "created")
  });

  copy(time, out, "focused");

  return out;
};

export const make_tab = (info, transient) => {
  const url   = record.get(info, "url");
  const title = record.get(info, "title");

  return record.make({
    "id": record.get(info, "id"),
    "time": make_time(record.get(info, "time")),

    "url": ref.make(url),
    // TODO maybe this should be server-side ?
    "title": ref.make(title || url),
    "favicon": ref.make(record.get(info, "favicon")),
    "pinned": ref.make(record.get(info, "pinned")),

    "focused": ref.make(transient !== null &&
                        record.get(transient, "focused")),
    "unloaded": ref.make(transient === null),
  });
};

export const make_group_tab = (group, tab) =>
  record.make({
    "id": record.get(tab, "id"),
    "time": record.get(tab, "time"),

    "url": record.get(tab, "url"),
    "title": record.get(tab, "title"),
    "favicon": record.get(tab, "favicon"),
    "pinned": record.get(tab, "pinned"),

    "focused": record.get(tab, "focused"),
    "unloaded": record.get(tab, "unloaded"),

    "selected": ref.make(false),
    "visible": ref.make(true), // TODO use `matches(tab)` ?
    "top": ref.make(null),

    "index": null, // TODO a little bit hacky
    "group": group
  });
