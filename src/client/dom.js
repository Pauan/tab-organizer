import { each } from "../util/iterator";


const to_html = (x) => {
  if (typeof x === "string") {
    return document["createTextNode"](x);
  } else {
    return x;
  }
};

export const div = (attr, children) => {
  const x = document["createElement"]("div");

  each(children, (child) => {
    x["appendChild"](to_html(child));
  });

  return x;
};

const top = document["createElement"]("div");

export const render = (x) => {
  top["innerHTML"] = "";
  top["appendChild"](x);
};

document["body"]["appendChild"](top);
