module Server.Main where

import Pauan.Prelude
import Pauan.Chrome as Chrome
import Pauan.Events as Events
import Pauan.Debug as Debug
import Control.Monad.Aff (attempt)


getMaximizedWindowCoordinates :: forall e. Chrome.WindowsState -> Aff (timer :: TIMER | e) Chrome.Coordinates
getMaximizedWindowCoordinates state = do
  win <- Chrome.createNewWindow state
    { type: Chrome.Normal
    , state: Chrome.Maximized
    , focused: true
    , incognito: false
    , tabs: [ Chrome.resolvePath "data/empty.html" ] }
  -- TODO this probably isn't needed, but it's better safe than sorry
  sleep 500
  { coordinates } <- Chrome.windowInfo win
  Chrome.closeWindow state win
  pure coordinates


main :: Eff (err :: EXCEPTION, timer :: TIMER) Unit
main = do
  -- TODO have it change the badge color (or icon) rather than alerting
  Debug.onError Debug.alertError

  mainAff do
    traceAnyA "initializing"
    state <- Chrome.initialize

    liftEff do
      windows <- Chrome.windows state
      traceAnyA windows

      stop <- Chrome.events state >> Events.receive \event ->
        traceAnyA event

      pure unit

    coords <- getMaximizedWindowCoordinates state
    traceAnyA coords

    traceAnyA "CREATING WINDOW 1"
    win <- Chrome.createNewWindow state
      { type: Chrome.Normal
      , state: Chrome.Regular { left: coords.left, top: coords.top, width: 300, height: coords.height }
      , focused: false
      , incognito: false
      , tabs: [] }

    tab <- Chrome.createNewTab state { window: win, url: Chrome.newTabPath, index: Just 0, focused: true, pinned: true }
    tab <- Chrome.createNewTab state { window: win, url: Chrome.newTabPath, index: Just 0, focused: true, pinned: true }
    tab <- Chrome.createNewTab state { window: win, url: Chrome.newTabPath, index: Just 0, focused: true, pinned: true }
    tab <- Chrome.createNewTab state { window: win, url: Chrome.newTabPath, index: Just 0, focused: true, pinned: true }

    tabs <- liftEff << Chrome.windowTabs win

    traceAnyA "CLOSING TABS"
    --Chrome.closeTabs state tabs

    Chrome.closeWindow state win

    {-traceAnyA "CREATING WINDOW 2"
    win <- Chrome.createNewWindow state
      { type: Chrome.Popup
      , state: Chrome.Regular { left: coords.left, top: coords.top, width: 300, height: coords.height }
      , focused: false
      , incognito: false
      , tabs: [ Chrome.newTabPath ] }

    windows <- liftEff do
      windows <- Chrome.windows state
      traceAnyA windows
      pure windows

    a <- traverse (\window -> do
      traceAnyA "CREATING TAB"
      tab <- Chrome.createNewTab state { window, url: Chrome.newTabPath, index: Just 0, focused: true, pinned: true }
      traceAnyA "FOCUSING TAB"
      Chrome.focusTab state tab
      Chrome.focusTab state tab
      traceAnyA "CLOSING TAB"
      Chrome.closeTab state tab
      --Chrome.changeTab { url: Nothing, pinned: Just true, focused: Nothing } tab
      ) (filter Chrome.windowIsNormal windows)

    Chrome.closeWindow state win-}

    traceAnyA "DONE"

    pure unit

    {-traverse_ (changeWindow { state: Just Maximized
                            , focused: Nothing
                            , drawAttention: Nothing }) a

    sleep 3000

    states <- traverse windowState a
    traceAnyA states

    traceAnyA a-}
