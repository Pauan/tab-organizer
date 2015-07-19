import { assert } from "../../../util/assert";
import { merge, always, empty } from "../../../util/stream";
import { Record } from "../../../util/immutable/record";
import { placeholder, $dragging } from "./tab";
import * as dom from "../../dom";


const style_group = dom.style({
  "width": "300px",
  "height": "100%",

  "border": "5px solid black",
  // TODO
  "background-color": "white",
});

const style_group_tabs = dom.style({
  "overflow": "auto",
  "height": "100%"
});

export const group = (group, init) => {
  const tabs = dom.col((e) =>
    merge([
      e.style_always(style_group_tabs),

      // TODO code duplication
      e.on_mouse_hover().keep((x) => x && $dragging.value).map(() => {
        // TODO this isn't quite right, but it works most of the time
        if ($dragging.value.group !== group) {
          // TODO a little hacky
          assert(placeholder.parent !== e);

          const index = e.children.size;

          $dragging.value.index = index;
          $dragging.value.group = group;

          e.insert(index, placeholder);
        }
      })
    ]));

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
