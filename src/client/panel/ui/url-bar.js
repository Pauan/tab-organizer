import * as dom from "../../dom";
import { Ref, always } from "../../../util/mutable/ref";


export const url_bar = new Ref(null);

const top_style = dom.style({
  "left": "0px",
  "bottom": "0px",

  "white-space": "pre",
  // TODO maybe remove this
  "max-width": dom.calc("100%", "+", "1px"),

  "border-top-width": "1px",
  "border-right-width": "1px",
  "border-top-color": "black",
  "border-right-color": "black",
  "border-top-right-radius": "5px",

  //e.set("paddingTop", "0px")
  "padding-right": "2px", // 2px + 3px = 5px
  "padding-bottom": "1px",
  //e.set("padding-left", "2px")

  "color": "black",

  "background-color": "white",

  "box-shadow": "0px 0px 3px dimgray",
});

const text_style = dom.style({
  "margin-left": "3px",
  "margin-right": "3px"
});

const protocol_style = dom.style({
  "font-weight": "bold",
  "color": dom.hsl(120, 100, 25)
});

const domain_style = dom.style({
  "font-weight": "bold"
});

const path_style = dom.style({});

const file_style = dom.style({
  "font-weight": "bold",
  "color": "darkred" // TODO replace with hsl
});

const query_style = dom.style({
  "font-weight": "bold",
  "color": "darkred" // TODO replace with hsl
});

const hash_style = dom.style({
  "color": "darkblue" // TODO replace with hsl
});


const spacify = (x) =>
  x["replace"](/_|\-/g, " ");

// http://en.wikipedia.org/wiki/URI_scheme#Generic_syntax
const re_uri = /^([a-zA-Z][a-zA-Z0-9\+\.\-]*:)(?:(\/\/)([^\@]+\@)?([^\/\?\#\:]*)(\:[0-9]+)?)?([^\?\#]*?)([^\/\?\#]*)(\?[^\#]*)?(\#.*)?$/;

const parse = (x) => {
  const a = re_uri["exec"](x);
  if (a) {
    return {
      protocol:  a[1]["toLocaleLowerCase"](),
      separator: a[2] || null,
      authority: a[3] || null,
      domain:    a[4] || null,
      port:      (a[5]
                   ? +a[5]
                   : null),
      path:      a[6] || null,
      file:      a[7] || null,
      query:     a[8] || null,
      hash:      a[9] || null
    }
  } else {
    throw new Error("Invalid URI: " + x)
  }
};

const simplify = (x) => {
  const y = {};

  if (x.protocol === "http:" || x.protocol === "https:") {
    y.protocol  = null;
    y.separator = null;

  } else {
    y.protocol  = x.protocol;
    y.separator = x.separator;
  }

  y.authority = x.authority;

  if (x.domain === null) {
    y.domain = x.domain;

  } else {
    // http://en.wikipedia.org/wiki/List_of_Internet_top-level_domains
    y.domain = x.domain["replace"](/^www\.|\.\w\w$/g, "") // .co.uk
                       ["replace"](/\.(?:aero|asia|biz|cat|com|co|coop|info|int|jobs|mobi|museum|name|net|org|pro|tel|travel|xxx|edu|gov|mil)$/, "")
                       // TODO: is this needed?
                       ["replace"](/\.\w\w$/, "") // .ac.edu
  }

  y.port  = x.port;
  y.path  = x.path;
  y.file  = x.file;
  y.query = x.query;
  y.hash  = x.hash;

  return y;
};

const minify = (x) => {
  const y = simplify(parse(x));

  const query = y.query;
  const path  = y.path;
  const file  = y.file;
  //const hash  = y.hash;

  y.query = null;
  y.path  = null;
  y.file  = null;
  //y.hash  = null;

  if (query) {
    y.query = query["replace"](/^\?/, "");
    y.query = y.query["replace"](/^[\+&;]/, "");
    y.query = y.query["replace"](/[\+&;]/g, ", ");
    y.query = y.query["replace"](/=/g, ":");
    y.query = spacify(decodeURIComponent(y.query));

  } else if (file) {
    y.file = spacify(decodeURIComponent(file["replace"](/\.(?:html?|php|asp)$/, "")));

  } else if (path) {
    y.path = spacify(decodeURIComponent(path));
    if (y.path === "/") {
      y.path = null;
    }
  }

  /*if (hash) {
    y.hash = spacify(decodeURIComponent(hash["replace"](/^\#/, "")));
  }*/

  return y;
};

const parsed_url = url_bar.map((x) => {
  if (x === null) {
    return x;
  } else {
    return minify(x.url);
  }
});

const make = (style, f) => {
  const x = parsed_url.map((x) => {
    if (x === null) {
      return "";
    } else {
      return f(x);
    }
  });

  return dom.row((e) => [
    e.children([
      dom.text(x)
    ]),

    e.style(text_style, always(true)),
    e.style(style, always(true)),

    e.visible(x)
  ]);
};

dom.floating((e) => [
  e.children([
    dom.row((e) => [
      // TODO check if any of these need "flex-shrink": 1
      e.children([
        make(protocol_style, (x) => x.protocol),
        make(domain_style, (x) => x.domain),
        make(path_style, (x) => x.path),
        make(file_style, (x) => x.file),
        make(query_style, (x) => x.query),
        make(hash_style, (x) => x.hash)
      ])
    ])
  ]),

  e.style(top_style, always(true)),

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
]);
