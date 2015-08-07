import * as dom from "../../dom";
import { Ref, always } from "../../../util/mutable/ref";
import { parse, minify } from "../../../util/url";


export const url_bar = new Ref(null);

const top_style = dom.style({
  "left": always("0px"),
  "bottom": always("0px"),

  // TODO maybe remove this
  "max-width": always(dom.calc("100%", "+", "1px")),

  "border-top-width": always("1px"),
  "border-right-width": always("1px"),
  "border-top-color": always(dom.hsl(0, 0, 45)),
  "border-right-color": always(dom.hsl(0, 0, 40)),
  "border-top-right-radius": always("5px"),

  //e.set("paddingTop", "0px")
  "padding-right": always("2px"), // 2px + 3px = 5px
  "padding-bottom": always("1px"),
  //e.set("padding-left", "2px")

  "color": always("black"),

  "background-color": always("white"),

  "box-shadow": always("0px 0px 3px dimgray"),
});

const text_style = dom.style({
  "margin-left": always("3px"),
  "margin-right": always("3px")
});

const protocol_style = dom.style({
  "font-weight": always("bold"),
  "color": always(dom.hsl(120, 100, 25))
});

const domain_style = dom.style({
  "font-weight": always("bold")
});

const path_style = dom.style({});

const file_style = dom.style({
  "font-weight": always("bold"),
  "color": always("darkred") // TODO replace with hsl
});

const query_style = dom.style({
  "font-weight": always("bold"),
  "color": always("darkred") // TODO replace with hsl
});

const hash_style = dom.style({
  "color": always("darkblue") // TODO replace with hsl
});

const parsed_url = url_bar.map_null(({ url }) => minify(parse(url)));

const make = (style, f) => {
  const x = parsed_url.map_null(f);

  return dom.text((e) => [
    e.set_style(text_style, always(true)),
    e.set_style(style, always(true)),

    e.visible(x),
    e.value(x)
  ]);
};

// TODO hacky
dom.main(dom.parent((e) => [
  e.set_style(dom.row, always(true)),
  e.set_style(dom.floating, always(true)),
  e.set_style(top_style, always(true)),

  // TODO check if any of these need "flex-shrink": 1
  e.children([
    make(protocol_style, (x) => x.protocol),
    make(domain_style, (x) => x.domain),
    make(path_style, (x) => x.path),
    make(file_style, (x) => x.file),
    make(query_style, (x) => x.query),
    make(hash_style, (x) => x.hash)
  ]),

  e.visible(url_bar)
/*
  // TODO is this correct ?
  // This makes the element visible if `url_bar` is not `null`, and then
  // it uses `get_position` to check if the mouse is on top of the element,
  // and if so, it will then hide the element
  e.visible(e.visible(url_bar).keep((o) => o !== null).map((o) => {
    const box = e.get_position();
    return o.x > box.right || o.y < box.top;
  }))*/
]));
