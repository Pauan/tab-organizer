import { lowercase, replace, match } from "./string";


const spacify = (x) =>
  replace(x, /[_\-]/g, " ");

// http://en.wikipedia.org/wiki/URI_scheme#Generic_syntax
const re_uri = /^([a-zA-Z][a-zA-Z0-9\+\.\-]*:)(?:(\/\/)([^\@]+\@)?([^\/\?\#\:]*)(\:[0-9]+)?)?([^\?\#]*?)([^\/\?\#]*)(\?[^\#]*)?(\#.*)?$/;

// TODO test this
export const parse = (x) => {
  const a = match(x, re_uri);
  if (a) {
    return {
      protocol:  lowercase(a[1]),
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
    };
  } else {
    throw new Error("Invalid URI: " + x);
  }
};

// http://en.wikipedia.org/wiki/List_of_Internet_top-level_domains
// TODO test this
const simplify_domain = (s) => {
  s = replace(s, /^www\.|\.\w\w$/g, ""); // .co.uk
  s = replace(s, /\.(?:aero|asia|biz|cat|com|co|coop|info|int|jobs|mobi|museum|na me|net|org|pro|tel|travel|xxx|edu|gov|mil)$/, "");
  // TODO: is this needed?
  // .ac.edu
  s = replace(s, /\.\w\w$/, "");
  return s;
};

// TODO test this
export const simplify = (x) => {
  const should_protocol = !(x.protocol === "http:" ||
                            x.protocol === "https:");

  return {
    protocol:  (should_protocol ? x.protocol  : null),
    separator: (should_protocol ? x.separator : null),
    authority: x.authority,
    domain:    (x.domain !== null
                 ? simplify_domain(x.domain)
                 : null),
    port:      x.port,
    path:      x.path,
    file:      x.file,
    query:     x.query,
    hash:      x.hash
  };
};

// TODO test this
export const minify = (x) => {
  const y = simplify(x);

  const path  = y.path;
  const file  = y.file;
  const query = y.query;

  y.path  = null;
  y.file  = null;
  y.query = null;

  y.hash = (y.hash !== null
             ? spacify(decodeURIComponent(y.hash))
             : null);


  if (query !== null) {
    y.query = replace(query, /^\?/, "");
    y.query = replace(y.query, /^[\+&;]/, "");
    y.query = replace(y.query, /[\+&;]/g, ", ");
    y.query = replace(y.query, /=/g, ":");
    y.query = spacify(decodeURIComponent(y.query));

  } else if (file !== null) {
    y.file = replace(file, /\.(?:html?|php|asp)$/, "");
    y.file = spacify(decodeURIComponent(y.file));

  } else if (path !== null && path !== "/") {
    y.path = spacify(decodeURIComponent(path));
  }

  return y;
};
