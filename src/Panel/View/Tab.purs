module Pauan.Panel.View.Tab where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.Animation as Animation
import Pauan.View (value)
import Pauan.Panel.Types (State, Group, Tab, Dragging)
import Pauan.HTML (widget, afterInsert, beforeRemove)


tabHeight :: Int
tabHeight = 20


row :: Trait
row = trait
  [ style "display" "flex"
  , style "flex-direction" "row"
  -- TODO get rid of this ?
  , style "align-items" "center" ]


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


menuItemShadowTrait :: Trait
menuItemShadowTrait =
  style "box-shadow" ("1px 1px  1px " ++ hsla 0 0   0 0.25 ++ "," ++
                "inset 0px 0px  3px " ++ hsla 0 0 100 1.0  ++ "," ++
                "inset 0px 0px 10px " ++ hsla 0 0 100 0.25)


repeatingGradient :: String
repeatingGradient =
  "repeating-linear-gradient(-45deg, " ++
    "transparent"     ++ " 0px, " ++
    "transparent"     ++ " 4px, " ++
    hsla 0 0 100 0.05 ++ " 6px, " ++
    hsla 0 0 100 0.05 ++ " 10px)"


menuItemHoverTrait :: View Boolean -> Trait
menuItemHoverTrait isHovering = trait
  -- TODO a bit hacky
  [ style "transition-duration"
      (mapIfTrue "0ms" isHovering)
  , style "background-image"
      (mapIfTrue
        ("linear-gradient(to bottom, " ++
           hsla 0 0 100 0.2 ++ " 0%, " ++
           "transparent"    ++ " 49%, " ++
           hsla 0 0   0 0.1 ++ " 50%, " ++
           hsla 0 0 100 0.1 ++ " 80%, " ++
           hsla 0 0 100 0.2 ++ " 100%)," ++
         repeatingGradient)
        isHovering)
  , style "color"
      (mapIfTrue (hsla 211 100 99 0.95) isHovering)
  , style "background-color"
      (mapIfTrue (hsl 211 100 65) isHovering)
  , style "border-color"
      (mapIfTrue
        (hsl 211 38 62 ++ " " ++
         hsl 211 38 57 ++ " " ++
         hsl 211 38 52 ++ " " ++
         hsl 211 38 57)
        isHovering)
  , style "text-shadow"
      (mapIfTrue
        ("1px 0px 1px " ++ hsla 0 0 0 0.2 ++ "," ++
         "0px 0px 1px " ++ hsla 0 0 0 0.1 ++ "," ++
         -- TODO why is it duplicated like this ?
         "0px 1px 1px " ++ hsla 0 0 0 0.2)
        isHovering) ]


draggingView :: State -> HTML
draggingView state =
  html "div"
    [ floating
    , style "pointer-events" "none"
    , style "opacity" "0.98"
    , style "overflow" "visible"
    , style "background-color" "blue"
    , style "width" (map width << view dragging)
    , style "transform" (map transform << view dragging |< view draggingPosition)
    , hidden (map (not <<< isJust) << view dragging) ]
    -- TODO make this more efficient ?
    (streamArray << map selected << view dragging)
  where
    dragging = state.dragging
    draggingPosition = state.draggingPosition

    selected :: Maybe Dragging -> Array HTML
    selected Nothing             = []
    -- TODO pass the index for each tab
    selected (Just { selected }) = mapWithIndex (tabViewDragging state) selected

    width :: Maybe Dragging -> String
    width Nothing          = ""
    width (Just { width }) = show width ++ "px"

    -- This causes it to be displayed on its own layer, so that we can
    -- move it around without causing a relayout or repaint
    transform :: Maybe Dragging -> Maybe DragEvent -> String
    transform (Just { offsetX, offsetY, left }) (Just { currentX, currentY }) =
      "translate3d(" ++
        show (fromMaybe (currentX - offsetX) left) ++ "px, " ++
        show (currentY - offsetY) ++ "px, 0px)"
    transform _ _ =
      "translate3d(0px, 0px, 0px)"


draggingTrait :: State -> Trait
draggingTrait { dragging } =
  style "cursor" (map (ifJust "grabbing" "") << view dragging)


draggable :: State -> Group -> Tab -> Trait
draggable { dragging, draggingPosition } group tab = trait
  [ onDrag
      {-
        // TODO should also support dragging when the type is "tag"
        mutable.get(group_type) === "window" &&
        !alt && !ctrl && !shift &&
        hypot(start_x - x, start_y - y) > 5
      -}
      { threshold: \e -> pure <<
          hypot (toNumber << e.startX - e.currentX) (toNumber << e.startY - e.currentY) > 5.0

      , start: \e -> do
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
              tabs >> filterM \x -> (view x.selected && view x.matchedSearch) >> value
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
              a.dragging >> Mutable.set true
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
                  b.dragging >> Mutable.set false
            dragging >> Mutable.set Nothing
            draggingPosition >> Mutable.set Nothing } ]


tabView' :: State -> Tab -> View Boolean -> Trait -> HTML
tabView' state tab isHovering trait = html "div"
  [ row
  , menuItemTrait state
  , menuItemHoverTrait isHovering
  , style "width" "100%"
  , style "height" (show tabHeight ++ "px")
  , style "padding" "1px"
  , style "border-radius" "5px"
  , style "font-weight" (mapIfTrue "bold" isHovering)
  , trait ]
  [ text tab.title ]


tabViewDragging :: State -> Int -> Tab -> HTML
tabViewDragging state index tab =
  tabView' state tab (pure (index == 0)) << trait
    [ style "z-index" (show (-index)) ]


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

  pure << tabView' state tab (view isHovering) << trait
    [ onHoverSet isHovering
    , draggable state group tab
    , style "display" (mapIf "flex" "none" << (view tab.matchedSearch && not (view tab.dragging)))
    , style "position" (map (ifJust "absolute" "") << view tab.top)
    , style "transform" (map transform << view tab.top) ]
    where
      transform Nothing    = ""
      transform (Just top) = "translate3d(0px, " ++ show top ++ "px, 0px)"
