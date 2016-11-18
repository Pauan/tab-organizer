module Options.Main where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.Panel.Types (Tab, makeState)
import Pauan.Panel.View.Tab (draggingTrait, draggingView, tabView)
import Pauan.HTML (render, widget)


makeTab :: Int -> Eff (mutable :: Mutable.MUTABLE) Tab
makeTab i = do
  top <- Mutable.make Nothing
  visible <- Mutable.make true
  selected <- Mutable.make false
  pure { title: show i, url: "", visible, top, selected }


root :: Eff (mutable :: Mutable.MUTABLE) HTML
root = do
  state <- makeState

  a <- sequence [makeTab 1, makeTab 2, makeTab 3]
  tabs <- Mutable.make a

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
            tabs <- sequence ((1..200) >> map makeTab)
            runTransaction do
              group.tabs >> Mutable.set tabs ]
        [ text "Activate" ]
    , html "div"
        []
        (view group.tabs >> map \a ->
          a >> map \tab ->
            widget \_ -> do
              pure << tabView state group tab) ]


main :: Eff (mutable :: Mutable.MUTABLE) Unit
main = do
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
