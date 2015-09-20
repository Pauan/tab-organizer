import * as dom from "../../dom";
import * as ref from "../../../util/ref";
import { parse, minify } from "../../../util/url";


export const url_bar = ref.make(null);

const top_style = dom.make_style({
  "pointer-events": ref.always("none"),

  "left": ref.always("0px"),
  "bottom": ref.always("0px"),

  // TODO maybe remove this
  "max-width": ref.always("calc(100% + 1px)"),

  "border-top-width": ref.always("1px"),
  "border-right-width": ref.always("1px"),
  "border-top-color": ref.always(dom.hsl(0, 0, 45)),
  "border-right-color": ref.always(dom.hsl(0, 0, 40)),
  "border-top-right-radius": ref.always("5px"),

  //e.set("paddingTop", "0px")
  "padding-right": ref.always("2px"), // 2px + 3px = 5px
  "padding-bottom": ref.always("1px"),
  //e.set("padding-left", "2px")

  "color": ref.always("black"),

  "background-color": ref.always("white"),

  "box-shadow": ref.always("0px 0px 3px dimgray"),
});

const text_style = dom.make_style({
  "margin-left": ref.always("3px"),
  "margin-right": ref.always("3px")
});

const protocol_style = dom.make_style({
  "font-weight": ref.always("bold"),
  "color": ref.always(dom.hsl(120, 100, 25))
});

const domain_style = dom.make_style({
  "font-weight": ref.always("bold")
});

const path_style = dom.make_style({});

const file_style = dom.make_style({
  "font-weight": ref.always("bold"),
  "color": ref.always("darkred") // TODO replace with hsl
});

const query_style = dom.make_style({
  "font-weight": ref.always("bold"),
  "color": ref.always("darkred") // TODO replace with hsl
});

const hash_style = dom.make_style({
  "color": ref.always("darkblue") // TODO replace with hsl
});

const parsed_url = ref.map_null(url_bar, (url) => minify(parse(url)));

const make = (style, f) => {
  const x = ref.map_null(parsed_url, f);

  return dom.text((e) => [
    dom.add_style(e, text_style),
    dom.add_style(e, style),

    // TODO a little bit hacky
    // TODO utility function to convert to a boolean ?
    dom.toggle_visible(e, ref.map(x, (x) => !!x)),
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

  dom.toggle_visible(e, url_bar)
]));
