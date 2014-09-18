require("../../hubs")

@ = require([
  { id: "sjs:object" },
  { id: "lib:util/dom" },
  { id: "../animation", name: "animation" }
])


var top = @CSS(`

`)

var tab_height = 20

var style = @CSS(`
  {
    height: ${tab_height}px;
    border: 1px solid transparent;
    overflow: hidden;
    padding: 1px 2px;
    border-radius: 3px;

    transform-origin: 20px 50%;
    transform: translate3d(0, 0, 0); /* TODO this is a hack to make animation smoother, should replace with something else */
  }

  &:hover {
    border-color: black;
    background-color: red;
  }
`)

var style_hidden = @animation.create({
  duration: 1000,
  css: @animation.hiddenSlide(
  {
    rotationX: "90deg", // 120deg
    rotationY: "90deg", // 20deg

    //transformPerspective: 5000,
    //transformOrigin: "0% 0%"
    //rotationZ: "1deg",
    //borderRadius: "#{tab_height}px",
    //scaleY: "0",
    //marginLeft: "#{tab_height}px"
  }
  )
})

/*var animation_id = 0

function Animation(info) {
  var id = "__animation_id_#{++animation_id}__"
  console.log(id, info)

  document.body ..@appendContent(@GlobalCSS("
    @-webkit-keyframes #{id} {
      #{info.parts[0]}
    }
  "))

  return {
    _id: id,
    duration: "5s"
  }
}

var style_hidden = Animation(`
  from {
    height: 0px;
  }
`)

function animate_from(elem, animation) {
  elem.style["-webkit-animation-name"] = ""
  getComputedStyle(elem).left

  elem.style["-webkit-animation-duration"] = animation.duration
  elem.style["-webkit-animation-direction"] = "reverse"
  elem.style["-webkit-animation-fill-mode"] = "both"
  elem.style["-webkit-animation-name"] = animation._id

  waitfor () {
    function done(e) {
      if (e.animationName === animation._id) {
        elem.removeEventListener("webkitAnimationEnd", done, true)
        resume()
      }
    }
    elem.addEventListener("webkitAnimationEnd", done, true)
  }
}

function animate_to(elem, animation) {
  elem.style["-webkit-animation-name"] = ""
  getComputedStyle(elem).left

  elem.style["-webkit-animation-duration"] = animation.duration
  elem.style["-webkit-animation-direction"] = "normal"
  elem.style["-webkit-animation-fill-mode"] = "both"
  elem.style["-webkit-animation-name"] = animation._id

  waitfor () {
    function done(e) {
      if (e.animationName === animation._id) {
        elem.removeEventListener("webkitAnimationEnd", done, true)
        resume()
      }
    }
    elem.addEventListener("webkitAnimationEnd", done, true)
  }
}*/

var tabs = [
  @Div("YUPYUPYUPYUPYUP") ..style,

  @Div("HIYA THERE YOU GUYS") ..style ..@Mechanism(function (elem) {
    while (true) {
      elem ..@animation.startAt(style_hidden)
      elem ..@animation.endAt(style_hidden)
    }
  }),

  @Div("UHUHUHU YES VERY NICE") ..style ..@Mechanism(function (elem) {
    while (true) {
      elem ..@animation.endAt(style_hidden)
      elem ..@animation.startAt(style_hidden)
    }
  }),

  @Div("NONONONONONONO") ..style
]

document.body ..@appendContent(@Div(tabs) ..top)


