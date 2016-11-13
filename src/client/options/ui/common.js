import * as dom from "../../../util/dom";
import * as mutable from "../../../util/mutable";


const style_category = dom.make_style({
  //"border-width": mutable.always("1px"),
  //"border-style": mutable.always("outset"),
  //"border-color": mutable.always(dom.hsl(0, 0, 15, 1)),
  "border-radius": mutable.always("5px"),

  "background-color": mutable.always(dom.hsl(0, 0, 99)),

  "padding": mutable.always("6px 10px 10px 10px"),

  "box-shadow": mutable.always("0px 0px  3px 1px " + dom.hsl(0, 0, 0, 0.5) + "," +
                           "1px 1px 10px 2px " + dom.hsl(0, 0, 0, 0.5)),

  "margin-bottom": mutable.always("30px")
});

const style_category_header = dom.make_style({
  "font-weight": mutable.always("bold"),

  "font-size": mutable.always("18px"),
  "color": mutable.always(dom.hsl(0, 0, 0, 0.8)),
  //"letter-spacing": mutable.always("1px"),
  //"font-variant": mutable.always("small-caps"),
  "text-shadow": mutable.always("1px 1px 2px " + dom.hsl(211, 30, 30, 0.15))
});

const style_category_separator = dom.make_style({
  "height": mutable.always("1px"),
  "margin-top": mutable.always("0.1em"),
  "margin-bottom": mutable.always("calc(0.5em + 2px)"), // TODO a bit hacky
  "background-color": mutable.always(dom.hsl(0, 0, 93)),
  //"background-color": mutable.always(dom.hsl(0, 0, 0, 0.05)),
});

const style_category_content = dom.make_style({
  "padding": mutable.always("0px 10px")
});

const category_header = (name) =>
  dom.text((e) => [
    dom.add_style(e, style_category_header),

    dom.set_value(e, mutable.always(name))
  ]);

const category_separator = () =>
  dom.child((e) => [
    dom.add_style(e, style_category_separator)
  ]);

const category_content = (children) =>
  dom.parent((e) => [
    dom.add_style(e, style_category_content),

    dom.children(e, children)
  ]);

export const category = (name, children) =>
  dom.parent((e) => [
    dom.add_style(e, style_category),

    dom.children(e, [
      category_header(name),
      category_separator(),
      category_content(children)
    ])
  ]);


// TODO code duplication with category.js
const style_separator = dom.make_style({
  "height": mutable.always("1px"),
  "margin-top": mutable.always("0.5em"),
  "margin-bottom": mutable.always("calc(0.5em + 2px)"), // TODO a bit hacky
  "background-color": mutable.always(dom.hsl(0, 0, 93)),
  //"background-color": mutable.always(dom.hsl(0, 0, 0, 0.05)),
});

export const separator = () =>
  dom.child((e) => [
    dom.add_style(e, style_separator)
  ]);


export const row = (a) =>
  dom.parent((e) => [
    dom.add_style(e, dom.row),
    dom.children(e, a)
  ]);


export const text = (s) =>
  dom.text((e) => [
    dom.set_value(e, mutable.always(s))
  ]);


export const horizontal_space = (s) =>
  dom.child((e) => [
    dom.style(e, {
      "width": mutable.always(s)
    })
  ]);

export const vertical_space = (s) =>
  dom.child((e) => [
    dom.style(e, {
      "height": mutable.always(s)
    })
  ]);


const style_header = dom.make_style({
  "font-weight": mutable.always("bold"),
  "margin-bottom": mutable.always("2px")
});

export const header = (s) =>
  dom.text((e) => [
    dom.add_style(e, style_header),
    dom.set_value(e, mutable.always(s))
  ]);


const style_indent = dom.make_style({
  "margin-left": mutable.always("12px"),
  // TODO hacky
  "align-items": mutable.always("flex-start"),
});

export const indent = (a) =>
  dom.parent((e) => [
    dom.add_style(e, dom.col),
    dom.add_style(e, style_indent),
    dom.children(e, a)
  ]);


export const stretch = () =>
  dom.child((e) => [
    dom.add_style(e, dom.stretch)
  ]);


export const style_dropdown = dom.make_style({
  "cursor": mutable.always("pointer"),

  "height": mutable.always("20px"),
  "box-shadow": mutable.always("1px 1px 4px " + dom.hsl(0, 0, 0, 0.2)),
  "padding-left": mutable.always("1px"),
  /* margin-top: -2px; */
  /* top: -2px; */
  "text-shadow": mutable.always("0px 1px 0px white"),
  "background-color": mutable.always(dom.hsl(211, 75, 99)),

  "background-image": mutable.always(dom.gradient("to bottom",
                                   ["0%", "transparent"],
                                   ["20%", dom.hsl(0, 0, 0, 0.04)],
                                   ["70%", dom.hsl(0, 0, 0, 0.05)],
                                   ["100%", dom.hsl(0, 0, 0, 0.1)])),

  "border-width": mutable.always("1px"),
  "border-radius": mutable.always("3px"),
  "border-color": mutable.always(dom.hsl(0, 0, 65) + " " +
                             dom.hsl(0, 0, 55) + " " +
                             dom.hsl(0, 0, 55) + " " +
                             dom.hsl(0, 0, 65)),
});

export const style_textbox = dom.make_style({
  "cursor": mutable.always("auto"),

  "box-shadow": mutable.always("0px 0px 3px " + dom.hsl(0, 0, 0, 0.5)),

  "margin-top": mutable.always("2px"),
  "margin-bottom": mutable.always("2px"),
  "margin-left": mutable.always("3px"),
  "margin-right": mutable.always("3px"),

  "border-width": mutable.always("1px"),
  "border-color": mutable.always("dimgray"), /* TODO replace with hsl value */
  "border-radius": mutable.always("3px"),

  "text-align": mutable.always("center"),
  "background-color": mutable.always(dom.hsl(211, 75, 99))
});

export const style_changed = dom.make_style({
  "border-color":     mutable.always(dom.hsl(200, 50, 60)),
  "background-color": mutable.always(dom.hsl(200, 50, 96))
});

export const style_invalid = dom.make_style({
  "border-color":     mutable.always(dom.hsl(0, 50, 60)),
  "background-color": mutable.always(dom.hsl(0, 50, 96))
});

export const style_icon = dom.make_style({
  //"top": mutable.always("1px"),
  "margin-right": mutable.always("3px")
});


// TODO code duplication with `style_dropdown`
const style_button = dom.make_style({
  "cursor": mutable.always("pointer"),

  /* min-height: 22px; */
  "padding-top": mutable.always("1px"),
  "padding-left": mutable.always("14px"),
  "padding-right": mutable.always("14px"),
  "padding-bottom": mutable.always("2px"),

  "text-shadow": mutable.always("0px 1px 0px white"),
  "background-color": mutable.always(dom.hsl(211, 75, 99)),

  "box-shadow": mutable.always("1px 1px 4px " + dom.hsl(0, 0, 0, 0.2)),

  "border-width": mutable.always("1px"),
  "border-radius": mutable.always("3px"),
  "border-color": mutable.always(dom.hsl(0, 0, 65) + " " +
                             dom.hsl(0, 0, 55) + " " +
                             dom.hsl(0, 0, 55) + " " +
                             dom.hsl(0, 0, 65)),

  "background-image": mutable.always(dom.gradient("to bottom",
                                   ["0%", "transparent"],
                                   ["20%", dom.hsl(0, 0, 0, 0.04)],
                                   ["70%", dom.hsl(0, 0, 0, 0.05)],
                                   ["100%", dom.hsl(0, 0, 0, 0.1)])),
});

const style_button_hover = dom.make_style({
  "background-color": mutable.always(dom.hsl(211, 100, 92))
});

const style_button_hold = dom.make_style({
  "padding-bottom": mutable.always("0px"),

  "box-shadow": mutable.always("none"),
  // TODO replace with hsl
  "border-color": mutable.always("gray silver silver gray"),

  "background-image": mutable.always(dom.gradient("to bottom",
                                   ["0%", "transparent"],
                                   ["15%", dom.hsl(0, 0, 0, 0.05)],
                                   ["85%", dom.hsl(0, 0, 0, 0.06)],
                                   ["100%", dom.hsl(0, 0, 0, 0.1)])),
});

export const button = (s, { on_click, height = "24px" }) =>
  dom.button((e) => {
    const hovering = mutable.make(false);
    const holding  = mutable.make(false);

    return [
      dom.add_style(e, style_button),

      dom.toggle_style(e, style_button_hover, hovering),

      dom.toggle_style(e, style_button_hold, mutable.and([
        hovering,
        holding
      ])),

      dom.on_mouse_hover(e, (hover) => {
        mutable.set(hovering, !!hover);
      }),

      dom.on_mouse_hold(e, (hold) => {
        mutable.set(holding, !!hold);
      }),

      dom.style(e, {
        "height": mutable.always(height)
      }),

      dom.on_left_click(e, () => {
        on_click();
      }),

      dom.children(e, [
        text(s)
      ])
    ];
  });
