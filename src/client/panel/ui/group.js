import { always } from "../../../util/mutable/ref";
import { tab as ui_tab } from "./tab";
import { drag_onto_group } from "../logic";
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
    //e.height("20px"),

    e.children([
      dom.text((e) => [
        e.value(group.get("name"))
      ])
    ])
  ]);

const group_tabs = (group) =>
  dom.col((e) => [
    e.set_style(style_group_tabs, always(true)),

    e.on_mouse_hover((hover) => {
      if (hover) {
        drag_onto_group(group);
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
