module Options.Main where

import Pauan.Prelude
import Pauan.Animation as Animation
import Pauan.HTML (render, body)


root :: HTML
root =
  widget \state -> do
    a <- Animation.make { duration: 500.0 }
    a >> Animation.tweenTo 1.0
    --state >> keepUntil (a >> view >> is 0.0)
    --runTransaction do
      --a >> Animation.jumpTo 1.0
    pure << html "div"
      [ styleView "width"
          (view a >> map (spy >>> Animation.easeOut Animation.easeExponential >>> Animation.rangeSuffix 0.0 100.0 "px"))
      , style "height" "50px"
      , style "background-color" "green" ]
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
