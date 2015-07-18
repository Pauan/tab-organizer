import { merge, always, empty } from "../../../util/stream";
import { Record } from "../../../util/immutable/record";
import * as dom from "../../dom";


const style_group = dom.style({
  "border": "5px solid black",
  // TODO
  "background-color": "white"
});

export const group = (group, init) => {
  const tabs = dom.col((e) => empty);

  const top = dom.col((e) => {
    e.push(dom.text(always(group.get("name"))));
    e.push(tabs);

    return merge([
      e.style_always(style_group)
    ]);
  });

  return Record([
    ["top", top],
    ["tabs", tabs]
  ]);
};
