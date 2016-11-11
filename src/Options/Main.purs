module Options.Main where

import Pauan.Prelude
import Pauan.Animation as Animation
import Pauan.Mutable as Mutable
import Pauan.HTML (render, widget, afterInsert, beforeRemove)
import Control.Monad.Eff.Timer (setTimeout)


root :: HTML
root =
  widget \state -> do
    a <- Mutable.make [1, 2, 3]

    --setTimeout 1000 << runTransaction do
      --a >> Mutable.set [4, 5, 6]

    pure << html "div"
      []
      [ html "button"
          [ on "click" \_ -> runTransaction do
              a >> Mutable.set (1..200) ]
          [ text "Activate" ]
      , html "div"
          []
          (view a >> map \a ->
            a >> map \(i :: Int) ->
              widget \state -> do
                a <- Animation.make { duration: 5000.0 }
                --"Widget before" >> spy >> pure
                state >> afterInsert do
                  --"afterInsert" >> spy >> pure
                  a >> Animation.tweenTo 1.0
                --"Widget after" >> spy >> pure
                state >> beforeRemove do
                  --"beforeRemove" >> spy >> pure
                  a >> Animation.tweenTo 0.0
                --state >> keepUntil (a >> view >> is 0.0)
                pure << html "div"
                  [ --style "position" "fixed"
                  --, style "left" "50px"
                  --, style "top" "50px"
                  style "transform" "translate3d(0, 0, 0)"
                  , style "width"
                      (view a >> map (Animation.easeOut Animation.easeExponential >>> Animation.rangeSuffix 0.0 100.0 "px"))
                  , style "height"
                      (view a >> map (Animation.easeInOut (Animation.easePow 4.0) >>> Animation.rangeSuffix 0.0 50.0 "px"))
                  , style "background-color"
                      (view a >> map \t ->
                        hsl
                          (t >> Animation.easePow 2.0 >> Animation.range 0.0 360.0)
                          100.0
                          50.0) ]
                  [ text (show i) ]) ]


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
