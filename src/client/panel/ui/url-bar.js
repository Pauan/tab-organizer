import * as dom from "../../../util/dom";
import * as mutable from "../../../util/mutable";
import { parse, minify } from "../../../util/url";


export const url_bar = mutable.make(null);

const top_style = dom.make_style({
  // TODO hack to make it smoother when showing/hiding the URL bar
  // TODO is this unneeded? maybe setting position: fixed is enough ?
  "transform": mutable.always("translateZ(0)"),

  "pointer-events": mutable.always("none"),

  "left": mutable.always("0px"),
  "bottom": mutable.always("0px"),

  // TODO maybe remove this
  "max-width": mutable.always("calc(100% + 1px)"),

  "border-top-width": mutable.always("1px"),
  "border-right-width": mutable.always("1px"),
  "border-top-color": mutable.always(dom.hsl(0, 0, 45)),
  "border-right-color": mutable.always(dom.hsl(0, 0, 40)),
  "border-top-right-radius": mutable.always("5px"),

  //e.set("paddingTop", "0px")
  "padding-right": mutable.always("2px"), // 2px + 3px = 5px
  "padding-bottom": mutable.always("1px"),
  //e.set("padding-left", "2px")

  "color": mutable.always("black"),

  "background-color": mutable.always("white"),

  "box-shadow": mutable.always("0px 0px 3px dimgray"),
});

const text_style = dom.make_style({
  "margin-left": mutable.always("3px"),
  "margin-right": mutable.always("3px")
});

const protocol_style = dom.make_style({
  "font-weight": mutable.always("bold"),
  "color": mutable.always(dom.hsl(120, 100, 25))
});

const domain_style = dom.make_style({
  "font-weight": mutable.always("bold")
});

const path_style = dom.make_style({});

const file_style = dom.make_style({
  "font-weight": mutable.always("bold"),
  "color": mutable.always("darkred") // TODO replace with hsl
});

const query_style = dom.make_style({
  "font-weight": mutable.always("bold"),
  "color": mutable.always("darkred") // TODO replace with hsl
});

const hash_style = dom.make_style({
  "color": mutable.always("darkblue") // TODO replace with hsl
});

const parsed_url = mutable.map_null(url_bar, (url) => minify(parse(url)));

const make = (style, f) => {
  const x = mutable.map_null(parsed_url, f);

  return dom.text((e) => [
    dom.add_style(e, text_style),
    dom.add_style(e, style),

    dom.toggle_visible(e, mutable.map(x, (x) =>
                            x !== null)),
    dom.set_value(e, x)
  ]);
};

// TODO hacky
dom.push_root(dom.parent((e) => [
  dom.add_style(e, dom.row),
  dom.add_style(e, dom.floating),
  dom.add_style(e, top_style),

  // TODO check if any of these need "flex-shrink": 1
  dom.children(e, [
    make(protocol_style, (x) => x.protocol),
    make(domain_style, (x) => x.domain),
    make(path_style, (x) => x.path),
    make(file_style, (x) => x.file),
    make(query_style, (x) => x.query),
    make(hash_style, (x) => x.hash)
  ]),

  dom.toggle_visible(e, mutable.map(url_bar, (x) =>
                          x !== null))
]));
