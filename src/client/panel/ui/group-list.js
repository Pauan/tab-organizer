import * as dom from "../../dom";


const style_group_list = dom.style({
  "align-items": "stretch", // TODO hacky
  "height": "100%"
});

export const group_list = () =>
  dom.row((e) =>
    e.style_always(style_group_list));
