@ = require([
  { id: "lib:util/dom" },
  { id: "../animation", name: "animation" }
])

var icon_style = @CSS(`
  height: 16px;
  border-radius: 4px;
  box-shadow: 0px 0px 15px hsla(0, 0%, 100%, 0.9);
  background-color: hsla(0, 0%, 100%, 0.35);
`)

var favicon_style = @CSS(`
  width: 16px;
`)

var text_style = @CSS(`
  white-space: pre;
  padding-left: 2px;
  padding-right: 2px;
`)

var repeating = "
  repeating-linear-gradient(-45deg, transparent 0px,
                                    transparent 4px,
                                    hsla(0, 0%, 100%, 0.05) 6px,
                                    hsla(0, 0%, 100%, 0.05) 10px)"

var tab_style = @CSS(`
  {
    height: 20px;
    border: 1px solid transparent;
    padding: 1px;
    border-radius: 5px;

    cursor: pointer;
    transition-property: background-color;
    transition-timing-function: ease-in-out;

    transform-origin: 11px 50%;
    transform: translate3d(0, 0, 0); /* TODO this is a hack to make animation smoother, should replace with something else */

/*
    // TODO a bit hacky
    cell.when(opt.loaded, function () {
      cell.bind([opt.get("theme.color")], function (hue) {
        e.set("text-shadow", "0px 1px 1px " + skew(hue, 61, 50, 0.1))
      })

      // TODO a bit of code duplication with ui.common.hover
      cell.bind([opt.get("theme.animation")], function (anim) {
        if (anim) {
          e.set("transition-duration", "100ms")
        } else {
          e.set("transition-duration", "0ms")
        }
      })
    })*/
  }

  &:hover {
    font-weight: bold;

    transition-duration: 0ms;

    background-image: linear-gradient(to bottom, hsla(0, 0%, 100%, 0.2) 0%,
                                                 transparent 49%,
                                                 hsla(0, 0%,   0%, 0.1) 50%,
                                                 hsla(0, 0%, 100%, 0.1) 80%,
                                                 hsla(0, 0%, 100%, 0.2) 100%), ${repeating};

    box-shadow:       1px 1px  1px hsla(0, 0%,   0%, 0.25),
                inset 0px 0px  3px hsla(0, 0%, 100%, 1   ),
                inset 0px 0px 10px hsla(0, 0%, 100%, 0.25);

/*
    // TODO a bit hacky
    cell.when(opt.loaded, function () {
      cell.bind([opt.get("theme.color")], function (hue) {
        e.set("color",            text(hue, 100, 99, 0.95))
        e.set("background-color", skew(hue, 100, 65))
        e.set("border-color",     skew(hue, 38, 57))
        e.set("text-shadow",      array.join(["1px 0px 1px " + shadow(hue, 61, 50),
                                              "0px 1px 1px " + shadow(hue, 61, 50)], ",")) // TODO why is this duplicated like this ?
      })
    })*/
  }
`)

exports.hidden_style = @animation.create({
  duration: 1000,
  css: @animation.hiddenSlide(
  {
    rotationX: "-90deg", // 120deg
    rotationY: "30deg", // 20deg
    rotationZ: "-1deg", // -1deg

    //transformPerspective: 5000,
    //transformOrigin: "0% 0%"
    //rotationZ: "1deg",
    //borderRadius: "#{tab_height}px",
    //scaleY: "0",
    //marginLeft: "#{tab_height}px"
  }
  )
})

function favicon(url) {
  return @Img(null, { src: url }) ..icon_style ..favicon_style
}

function text(title) {
  return @Div(title) ..text_style ..@stretch ..@clip
}

exports.create = function (tab) {
  return @Div([favicon(tab.favicon), text(tab.title)]) ..tab_style ..@horizontal ..@clip // TODO is this clip needed ?
}
