module Pauan.Panel.View.Tab where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.Animation as Animation
import Pauan.View (value)
import Pauan.Panel.Types (State, Group, Tab)
import Pauan.HTML (widget, afterInsert, beforeRemove)


tabHeight :: Int
tabHeight = 20


row :: Trait
row = trait
  [ style "display" "flex"
  , style "flex-direction" "row"
  -- TODO get rid of this ?
  , style "align-items" "center" ]


tabTrait :: Trait
tabTrait = trait
  [ style "width" "100%"
  , style "height" (show tabHeight ++ "px")
  , style "padding" "1px"
  , style "border-radius" "5px" ]


menuItemTrait :: State -> Trait
menuItemTrait { dragging } = trait
  [ style "cursor" (map (ifJust "" "pointer") << view dragging)
  , style "border-width" "1px"
  {-"transition": mutable.latest([
    opt("theme.animation"),
    dragging_animate
  ], (animation, dragging_animate) =>
    (animation
      ? (dragging_animate
          // TODO minor code duplication
          ? "background-color 100ms ease-in-out, transform 100ms ease-out"
          : "background-color 100ms ease-in-out")
      : null)),-} ]


draggingView :: State -> HTML
draggingView { dragging, draggingPosition } =
  html "div"
    [ floating
    , style "pointer-events" "none"
    , style "opacity" "0.98"
    , style "overflow" "visible"
    , style "background-color" "blue"
    , style "width" (map width << view dragging)
    , style "transform" (map transform << view dragging |< view draggingPosition)
    , hidden (map (not <<< isJust) << view dragging) ]
    (map selected << view dragging)
  where
    selected Nothing             = []
    -- TODO pass the index for each tab
    selected (Just { selected }) = map tabViewDragging selected

    width Nothing          = ""
    width (Just { width }) = show width ++ "px"

    -- This causes it to be displayed on its own layer, so that we can
    -- move it around without causing a relayout or repaint
    transform (Just { offsetX, offsetY, left }) (Just { screenX, screenY }) =
      "translate3d(" ++
        show (case left of
               Nothing -> screenX - offsetX
               Just left' -> left') ++ "px, " ++
        show (screenY - offsetY) ++ "px, 0px)"
    transform _ _ =
      "translate3d(0px, 0px, 0px)"


draggingTrait :: State -> Trait
draggingTrait { dragging } =
  style "cursor" (map (ifJust "grabbing" "") << view dragging)


draggable :: State -> Group -> Tab -> Trait
draggable { dragging, draggingPosition } group tab = trait
  [ onDrag
      { start: \e -> do
          {-
          const tabs = record.get(group, "tabs");

          const selected = list.make();

          list.each(stream.current(tabs), (x) => {
            if (mutable.get(record.get(x, "selected")) &&
                // TODO is this correct ?
                mutable.get(record.get(x, "visible"))) {
              list.push(selected, x);
            }
          });

          if (list.size(selected) === 0) {
            list.push(selected, tab);
          }

          list.each(selected, (tab) => {
            mutable.set(record.get(tab, "visible"), false);
          });

          // TODO hacky
          const height = (list.size(selected) === 1
                           ? tab_height
                           : (tab_height +
                              (Math["min"](list.size(selected), 4) * 3)));

          dragging_should_x = (mutable.get(opt("groups.layout")) !== "vertical");
          dragging_offset_x = (x - tab_box.left);
          dragging_offset_y = (tab_height / 2) + 1;

          mutable.set(dragging_dimensions, {
            x: (x - dragging_offset_x),
            y: (y - dragging_offset_y)
          });

          mutable.set(dragging_started, {
            selected: selected,
            width: Math["round"](tab_box.width)
          });

          drag_start({ group, tab, height });
          -}
          -- TODO check for visible ?
          isSelected <- tab.selected >> view >> value
          selected <- if isSelected
            then do
              tabs <- group.tabs >> view >> value
              tabs >> filterM (\x -> do
                                a <- x.selected >> view >> value
                                b <- x.visible >> view >> value
                                pure (a && b))
            else [tab] >> pure
          runTransaction do
            let len = length selected
            -- TODO (mutable.get(opt("groups.layout")) !== "vertical");
            let left = if false then Nothing else Just e.position.left
            let width = e.position.width
            -- TODO (tab_height + (Math["min"](list.size(selected), 4) * 3))
            let height = if len == 1 then tabHeight else tabHeight + ((min len 4) * 3)
            let offsetX = (width / 2)
            let offsetY = (tabHeight / 2) + 1
            for_ selected \a -> do
              a.visible >> Mutable.set false
            dragging >> Mutable.set (Just { left, width, height, offsetX, offsetY, selected })
            draggingPosition >> Mutable.set (Just e)

      , move: \e -> runTransaction do
          draggingPosition >> Mutable.set (Just e)

      , end: \_ -> do
          a <- dragging >> view >> value
          runTransaction do
            -- TODO a bit gross
            case a of
              Nothing -> pure unit
              Just { selected } -> do
                for_ selected \b -> do
                  b.visible >> Mutable.set true
            dragging >> Mutable.set Nothing
            draggingPosition >> Mutable.set Nothing } ]


tabViewDragging :: Tab -> HTML
tabViewDragging { title } = html "div"
  []
  [ text title ]


tabView :: State -> Group -> Tab -> HTML
tabView state group tab = widget \state' -> do
  a <- Animation.make { duration: 5000.0 }

  --"Widget before" >> spy >> pure
  state' >> afterInsert do
    --"afterInsert" >> spy >> pure
    a >> Animation.tweenTo 1.0
  --"Widget after" >> spy >> pure
  state' >> beforeRemove do
    --"beforeRemove" >> spy >> pure
    a >> Animation.tweenTo 0.0

  --state' >> keepUntil (a >> view >> is 0.0)
  isHovering <- Mutable.make false

  let
    width =
      Animation.easeOut Animation.easeExponential >>> Animation.rangeSuffix 0.0 100.0 "px"

    height =
      Animation.easeInOut (Animation.easePow 4.0) >>> Animation.rangeSuffix 0.0 50.0 "px"

    opacity hovering =
      if hovering then "1" else "0.5"

    backgroundColor t =
      hsla
        (t >> Animation.easePow 2.0 >> Animation.range 0.0 360.0)
        100.0
        50.0
        0.5

  pure << html "div"
    [ row
    , tabTrait
    , menuItemTrait state
    , onHoverSet isHovering
    , draggable state group tab
    , style "background-color" (map backgroundColor << view a)
    , style "display" (map (\a -> if a then "flex" else "none") << view tab.visible)
    , style "position" (map (ifJust "absolute" "") << view tab.top)
    , style "transform" (map transform << view tab.top) ]
    [ text tab.title ]
    where
      transform Nothing    = ""
      transform (Just top) = "translate3d(0px, " ++ show top ++ "px, 0px)"
