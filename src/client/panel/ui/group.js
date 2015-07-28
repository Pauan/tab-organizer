import { assert } from "../../../util/assert";
import { always } from "../../../util/mutable/ref";
import { drag_info, tab as ui_tab } from "./tab";
import * as dom from "../../dom";


const style_group = dom.style({
  "width": always("300px"),
  "height": always("100%"),

  "border": always("5px solid black"),
  // TODO
  "background-color": always("white"),
});

const style_group_tabs = dom.style({
  "overflow": always("auto"),
  "flex": always("1"), // TODO is this correct ?
  //"height": "100%"
});

const group_header = (group) =>
  dom.row((e) => [
    e.children([
      dom.text(group.get("name"))
    ])
  ]);

const group_tabs = (group) =>
  dom.col((e) => [
    e.set_style(style_group_tabs, always(true)),

    e.on_mouse_hover((hover) => {
      const info = drag_info.get();

      // TODO this isn't quite right, but it works most of the time
      if (hover && info && info.group !== group) {
        // TODO is this guaranteed to be correct ?
        assert(group.get("tabs").size > 0);

        drag_info.set({
          group: group,
          tab: group.get("tabs").get(-1),
          height: info.height,
          direction: "down"
        });
      }
    }),

    e.children(group.get("tabs").map((x) => ui_tab(group, x)))
  ]);

export const group = (group) =>
  dom.col((e) => [
    e.set_style(style_group, always(true)),

    e.children([
      group_header(group),
      group_tabs(group)
    ])
  ]);
