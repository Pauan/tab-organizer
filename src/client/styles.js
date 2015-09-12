import * as dom from "./dom";
import * as ref from "../util/ref";


dom.make_stylesheet("*", {
  "text-overflow": ref.always("ellipsis"),

  "vertical-align": ref.always("middle"), /* TODO I can probably get rid of this */

  /* TODO is this correct ?*/
  "background-repeat": ref.always("no-repeat"),
  "background-size": ref.always("100% 100%"),
  "cursor": ref.always("inherit"),
  "position": ref.always("relative"),

  "box-sizing": ref.always("border-box"),

  /* TODO are these a good idea ? */
  "outline-width": ref.always("0px"),
  "outline-color": ref.always("transparent"),
  "outline-style": ref.always("solid"),

  "border-width": ref.always("0px"),
  "border-color": ref.always("transparent"),
  "border-style": ref.always("solid"),

  "margin": ref.always("0px"),
  "padding": ref.always("0px"),

  "background-color": ref.always("transparent"),

  "flex-shrink": ref.always("0"), /* 1 */
  "flex-grow": ref.always("0"), /* 1 */
  "flex-basis": ref.always("auto"), /* 0% */ /* TODO try out other stuff like min-content once it becomes available */
});

/* Can't set this for all elements, or it will break badly */
dom.make_stylesheet("body > *", {
  "white-space": ref.always("pre"),
});

dom.make_stylesheet("html, body", {
  "-webkit-user-select": ref.always("none"), /* TODO this is hacky, use JS instead ? */
  "cursor": ref.always("default"),
  "width": ref.always("100%"),
  "height": ref.always("100%"),
});

/* Overwriting Webkit's silly user agent style */
dom.make_stylesheet("input, textarea, keygen, select, button", {
  "font": ref.always("inherit")
});

dom.make_stylesheet("table", {
  "border-spacing": ref.always("0px")
});
