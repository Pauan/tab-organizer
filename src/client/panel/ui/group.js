import { always } from "../../../util/mutable/ref";
import { tab as ui_tab } from "./tab";
import { drag_onto_group } from "../logic";
import * as dom from "../../dom";


const style_group = dom.style({
  //"width": always("300px"),
  //"height": always("100%"),
  "margin-top": always("-1px"),
  "border-top": always("1px solid black"),
  "padding-bottom": always("1px"),
  // TODO
  "background-color": always("white"),
});

const style_group_tabs = dom.style({
  // Magical incantation to make it much smoother
  //"transform": always("translate3d(0px, 0px, 0px"),

  //"transition": always("height 1000ms ease-in-out"),
  "overflow-y": always("auto"),
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
    e.set_style(dom.stretch, always(true)),
    e.set_style(style_group_tabs, always(true)),

    e.style({
      "height": group.get("height")
    }),

    // TODO
    /*e.on_mouse_hover((hover) => {
      if (hover) {
        drag_onto_group(group);
      }
    }),*/

    e.children(group.get("tabs").map((x) => ui_tab(group, x)))
  ]);

export const group = (group) =>
  dom.col((e) => [
    e.set_style(style_group, always(true)),

    e.visible(group.get("matches")),

    e.children([
      group_header(group),
      group_tabs(group)
    ])
  ]);
