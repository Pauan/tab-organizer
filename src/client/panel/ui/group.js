import { assert } from "../../../util/assert";
import { always } from "../../../util/mutable/ref";
import { placeholder, $dragging, tab as ui_tab } from "./tab";
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
  "flex": "1", // TODO is this correct ?
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
    e.style(style_group_tabs, always(true)),

/*
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
    }),*/

    e.children(group.get("tabs").map(ui_tab))
  ]);

export const group = (group) =>
  dom.col((e) => [
    e.style(style_group, always(true)),

    e.children([
      group_header(group),
      group_tabs(group)
    ])
  ]);
