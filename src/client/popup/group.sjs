@ = require([
  { id: "lib:util/dom" },
  { id: "../animation", name: "animation" }
])

var group_style = @CSS(`
  {
    top: -1px;
    border-top: 1px solid black;

    transform-origin: 11px 0%;
    transform: translate3d(0, 0, 0); /* TODO this is a hack to make animation smoother, should replace with something else */
  }
`)

var group_top_style = @CSS(`
  padding-left: 2px;
`)

exports.hidden_style = @animation.create({
  duration: 1000,
  css: @animation.hiddenSlide({
    rotationX: "-90deg",
    rotationY: "5deg",
    rotationZ: "-1deg"
  })
})

function group_top(name) {
  return @Div(name) ..group_top_style
}

exports.create = function (info, tabs) {
  return @Div([group_top(info.name), tabs]) ..group_style ..@clip
}
