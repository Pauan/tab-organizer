module Pauan.Panel.View.Dragging where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.Panel.State.Tab (Tab)


type Dragging =
  { children :: Mutable.Mutable (Array Tab)
  , dragging :: Mutable.Mutable (Maybe DragEvent) }


draggingMake :: Eff (mutable :: Mutable.MUTABLE) Dragging
draggingMake = do
  children <- Mutable.make []
  dragging <- Mutable.make Nothing
  pure { children, dragging }


draggingView :: Dragging -> HTML
draggingView { children, dragging } =
  html "div"
    [ floating
    , style "pointer-events" "none"
    , style "opacity" "0.98"
    , style "overflow" "visible"
    -- This causes it to be displayed on its own layer, so that we can
    -- move it around without causing a relayout or repaint
    , style "transform" "translate3d(0px, 0px, 0px)" ]
    (map viewChildren << view children)
  where
    viewChildren :: Array Tab -> Array HTML
    viewChildren a =
      a >> map \a ->
        html "div"
          []
          []


draggingTrait :: Dragging -> Trait
draggingTrait { dragging } =
  style "cursor" (map (ifJust "grabbing" "") << view dragging)


draggable :: Dragging -> Trait
draggable { children, dragging } =  trait
  [ onDragSet dragging
  , property "hidden" (map isJust << view dragging) ]
  where
    transform Nothing = ""
    -- This causes it to be displayed on its own layer, so that we can
    -- move it around without causing a relayout or repaint
    transform (Just x) = "translate3d(" ++ show x.offsetX ++ "px, " ++ show x.offsetY ++ "px, 0)"
