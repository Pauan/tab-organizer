import * as dom from "./dom";
import { always } from "../util/ref";


dom.stylesheet("*", {
  "text-overflow": always("ellipsis"),

  "vertical-align": always("middle"), /* TODO I can probably get rid of this */

  /* TODO is this correct ?*/
  "background-repeat": always("no-repeat"),
  "background-size": always("100% 100%"),
  "cursor": always("inherit"),
  "position": always("relative"),

  "box-sizing": always("border-box"),

  /* TODO are these a good idea ? */
  "outline-width": always("0px"),
  "outline-color": always("transparent"),
  "outline-style": always("solid"),

  "border-width": always("0px"),
  "border-color": always("transparent"),
  "border-style": always("solid"),

  "margin": always("0px"),
  "padding": always("0px"),

  "background-color": always("transparent"),

  "flex-shrink": always("0"), /* 1 */
  "flex-grow": always("0"), /* 1 */
  "flex-basis": always("auto"), /* 0% */ /* TODO try out other stuff like min-content once it becomes available */
});

/* Can't set this for all elements, or it will break badly */
dom.stylesheet("body > *", {
  "white-space": always("pre"),
});

dom.stylesheet("html, body", {
  "-webkit-user-select": always("none"), /* TODO this is hacky, use JS instead ? */
  "cursor": always("default"),
  "width": always("100%"),
  "height": always("100%"),
});
