module Options.Main where

import Pauan.Prelude
import Pauan.Animation as Animation
import Pauan.HTML (render, widget, afterInsert, beforeRemove)


root :: HTML
root =
  widget \state -> do
    a <- Animation.make { duration: 5000.0 }
    "Widget before" >> spy >> pure
    state >> afterInsert do
      "afterInsert" >> spy >> pure
      a >> Animation.tweenTo 1.0
    "Widget after" >> spy >> pure
    state >> beforeRemove do
      a >> Animation.tweenTo 0.0
    --state >> keepUntil (a >> view >> is 0.0)
    pure << html "div"
      [ style "position" "fixed"
      , style "left" "0px"
      , style "top" "0px"
      , style "transform" "translate3d(0, 0, 0)"
      , styleView "width"
          -- Animation.easeOut Animation.easeExponential >>>
          (view a >> map (spy >>> Animation.rangeSuffix 0.0 100.0 "px"))
      , styleView "height"
          (view a >> map (Animation.rangeSuffix 0.0 50.0 "px"))
      , styleView "background-color"
          (view a >> map \t ->
            hsl
              (Animation.range 0.0 360.0 t)
              100.0
              50.0) ]
      []


main :: Eff () Unit
main = root >> render >> void

{-main :: Eff (err :: EXCEPTION) Unit
main = void << launchAff do
  liftEff do-}
    {-a <- Mutable.make 1
    b <- Mutable.make 2
    c <- Mutable.make 3
    observe
      (\a -> show a >> log)
      --(map (\a b c -> a + b + c) << view a |< view b |< view c)
      (view a >|
       view b >|
       view c >>
       map \a b c ->
         a + b + c)
      >> void
    runTransaction do
      a >> Mutable.set 20
    runTransaction do
      b >> Mutable.set 30
    runTransaction do
      c >> Mutable.set 40
    runTransaction do
      a >> Mutable.set 1
      b >> Mutable.set 2
      c >> Mutable.set 3-}
