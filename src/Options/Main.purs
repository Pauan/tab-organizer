module Options.Main where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.MutableArray as MutableArray
import Pauan.Panel.Types (Tab, makeState)
import Pauan.Panel.View.Tab (draggingTrait, draggingView, tabView)
import Pauan.HTML (render)
import Pauan.Animation as Animation
import Pauan.StreamArray (mapWithIndex)


makeTab :: forall eff. String -> Eff (mutable :: Mutable.MUTABLE | eff) Tab
makeTab title = do
  top <- Mutable.make Nothing
  matchedSearch <- Mutable.make true
  dragging <- Mutable.make false
  selected <- Mutable.make false
  pure { title, url: "", matchedSearch, dragging, top, selected }


root :: forall eff. Eff (mutable :: Mutable.MUTABLE | eff) HTML
root = do
  state <- makeState

  a <- sequence
    ((0..20) >> map \_ -> makeTab "Testing testing")
  tabs <- MutableArray.make a

  let group = { tabs }

  --setTimeout 1000 << runTransaction do
    --a >> Mutable.set [4, 5, 6]
  pure << html "div"
    [ draggingTrait state
    , style "width" "100%"
    , style "height" "100%"
    , style "user-select" "none" ]
    [ draggingView state
    , html "button"
        [ on "click" \_ -> do
            tab <- makeTab "Testing testing"
            runTransaction do
              group.tabs >> MutableArray.deleteAt 0
              group.tabs >> MutableArray.push tab ]
        [ text "Activate" ]
    , html "div"
        [ style "overflow" "hidden" ]
        -- TODO make this more efficient ?
        (group.tabs >> streamArray >> mapWithIndex (tabView state group) >> Animation.animatedMap
          (\animation f -> f (animation >> map (Animation.easeInOut (Animation.easePow 2.0))))
          { replace: [ Animation.Jump { to: 1.0 } ]
          , insert: [ Animation.Tween { to: 1.0, duration: 500.0 } ]
          , update: []
          , remove: [ Animation.Tween { to: 0.0, duration: 500.0 } ] }) ]


main :: forall eff. Eff (mutable :: Mutable.MUTABLE | eff) Unit
main = do
  --_ <- [1, 2, 3] >> stream >> each (spy >>> pure >>> void) (spy >>> pure) (pure unit)
  a <- root
  a >> render >> void

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
