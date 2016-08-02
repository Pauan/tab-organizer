import * as dom from "../util/dom";
import * as mutable from "../util/mutable";


dom.make_stylesheet("*", {
  "text-overflow": mutable.always("ellipsis"),

  "vertical-align": mutable.always("middle"), /* TODO I can probably get rid of this */

  /* TODO is this correct ?*/
  "background-repeat": mutable.always("no-repeat"),
  "background-size": mutable.always("100% 100%"),
  "cursor": mutable.always("inherit"),
  "position": mutable.always("relative"),

  "box-sizing": mutable.always("border-box"),

  /* TODO are these a good idea ? */
  "outline-width": mutable.always("0px"),
  "outline-color": mutable.always("transparent"),
  "outline-style": mutable.always("solid"),

  "border-width": mutable.always("0px"),
  "border-color": mutable.always("transparent"),
  "border-style": mutable.always("solid"),

  "margin": mutable.always("0px"),
  "padding": mutable.always("0px"),

  "background-color": mutable.always("transparent"),

  "flex-shrink": mutable.always("0"), /* 1 */
  "flex-grow": mutable.always("0"), /* 1 */
  "flex-basis": mutable.always("auto"), /* 0% */ /* TODO try out other stuff like min-content once it becomes available */
});

/* Can't set this for all elements, or it will break badly */
dom.make_stylesheet("body > *", {
  "white-space": mutable.always("pre"),
});

dom.make_stylesheet("html, body", {
  "-webkit-user-select": mutable.always("none"), /* TODO this is hacky, use JS instead ? */
  "cursor": mutable.always("default"),
  "width": mutable.always("100%"),
  "height": mutable.always("100%"),
});

/* Overwriting Webkit's silly user agent style */
dom.make_stylesheet("input, textarea, keygen, select, button", {
  "font": mutable.always("inherit")
});

dom.make_stylesheet("table", {
  "border-spacing": mutable.always("0px")
});
