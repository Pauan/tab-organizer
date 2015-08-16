import * as dom from "../../dom";
import { always } from "../../../util/ref";


const style_category = dom.style({
  //"border-width": always("1px"),
  //"border-style": always("outset"),
  //"border-color": always(dom.hsl(0, 0, 15, 1)),
  "border-radius": always("5px"),

  "background-color": always(dom.hsl(0, 0, 99)),

  "padding": always("6px 10px 10px 10px"),

  "box-shadow": always("0px 0px  3px 1px " + dom.hsl(0, 0, 0, 0.5) + "," +
                       "1px 1px 10px 2px " + dom.hsl(0, 0, 0, 0.5)),

  "margin-bottom": always("30px")
});

const style_category_header = dom.style({
  "font-weight": always("bold"),

  "font-size": always("18px"),
  "color": always(dom.hsl(0, 0, 0, 0.8)),
  //"letter-spacing": always("1px"),
  //"font-variant": always("small-caps"),
  "text-shadow": always("1px 1px 2px " + dom.hsl(211, 30, 30, 0.15))
});

const style_category_separator = dom.style({
  "height": always("1px"),
  "margin-top": always("0.1em"),
  "margin-bottom": always("calc(0.5em + 2px)"), // TODO a bit hacky
  "background-color": always(dom.hsl(0, 0, 93)),
  //"background-color": always(dom.hsl(0, 0, 0, 0.05)),
});

const style_category_content = dom.style({
  "padding": always("0px 10px")
});

const category_header = (name) =>
  dom.text((e) => [
    e.set_style(style_category_header, always(true)),

    e.value(always(name))
  ]);

const category_separator = () =>
  dom.child((e) => [
    e.set_style(style_category_separator, always(true))
  ]);

const category_content = (children) =>
  dom.parent((e) => [
    e.set_style(style_category_content, always(true)),

    e.children(children)
  ]);

export const category = (name, children) =>
  dom.parent((e) => [
    e.set_style(style_category, always(true)),

    e.children([
      category_header(name),
      category_separator(),
      category_content(children)
    ])
  ]);


// TODO code duplication with category.js
const style_separator = dom.style({
  "height": always("1px"),
  "margin-top": always("0.5em"),
  "margin-bottom": always("calc(0.5em + 2px)"), // TODO a bit hacky
  "background-color": always(dom.hsl(0, 0, 93)),
  //"background-color": always(dom.hsl(0, 0, 0, 0.05)),
});

export const separator = () =>
  dom.child((e) => [
    e.set_style(style_separator, always(true))
  ]);


export const row = (a) =>
  dom.parent((e) => [
    e.set_style(dom.row, always(true)),
    e.children(a)
  ]);


export const text = (s) =>
  dom.text((e) => [
    e.value(always(s))
  ]);


export const vertical_space = (s) =>
  dom.child((e) => [
    e.style({
      "height": always(s)
    })
  ]);


const style_header = dom.style({
  "font-weight": always("bold"),
  "margin-bottom": always("6px")
});

export const header = (s) =>
  dom.text((e) => [
    e.set_style(style_header, always(true)),
    e.value(always(s))
  ]);


const style_indent = dom.style({
  "margin-left": always("12px")
});

export const indent = (a) =>
  dom.parent((e) => [
    e.set_style(style_indent, always(true)),
    e.children(a)
  ]);


export const style_dropdown = dom.style({
  "cursor": always("pointer"),

  "height": always("20px"),
  "box-shadow": always("0px 0px 1px " + dom.hsl(0, 0, 0, 0.4)),
  "padding-left": always("1px"),
  /* margin-top: -2px; */
  /* top: -2px; */
  "text-shadow": always("0px 1px 0px white"),
  "background-color": always(dom.hsl(211, 75, 99)),

  "background-image": always(dom.gradient("to bottom",
                               ["0%", "transparent"],
                               ["20%", dom.hsl(0, 0, 0, 0.01)],
                               ["80%", dom.hsl(0, 0, 0, 0.02)],
                               ["100%", dom.hsl(0, 0, 0, 0.05)])),

  "border-width": always("1px"),
  "border-radius": always("3px"),
  "border-color": always(dom.hsl(0, 0, 65) + " " +
                         dom.hsl(0, 0, 55) + " " +
                         dom.hsl(0, 0, 55) + " " +
                         dom.hsl(0, 0, 65)),
});

export const style_textbox = dom.style({
  "cursor": always("auto"),

  "box-shadow": always("0px 0px 3px " + dom.hsl(0, 0, 0, 0.5)),

  "margin-top": always("2px"),
  "margin-bottom": always("2px"),
  "margin-left": always("3px"),
  "margin-right": always("3px"),

  "border-width": always("1px"),
  "border-color": always("dimgray"), /* TODO replace with hsl value */
  "border-radius": always("3px"),

  "text-align": always("center"),
  "background-color": always(dom.hsl(211, 75, 99))
});

export const style_changed = dom.style({
  "border-color":     always(dom.hsl(200, 50, 60)),
  "background-color": always(dom.hsl(200, 50, 96))
});

export const style_invalid = dom.style({
  "border-color":     always(dom.hsl(0, 50, 60)),
  "background-color": always(dom.hsl(0, 50, 96))
});

export const style_icon = dom.style({
  "top": always("1px"),
  "margin-right": always("3px")
});
