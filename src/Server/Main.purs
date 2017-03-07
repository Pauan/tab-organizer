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

    win <- Chrome.createNewWindow state
      { type: Chrome.Normal
      , state: Chrome.Regular { left: coords.left, top: coords.top, width: 300, height: coords.height }
      , focused: true
      , incognito: false
      , tabs: [] }

    win <- Chrome.createNewWindow state
      { type: Chrome.Popup
      , state: Chrome.Regular { left: coords.left, top: coords.top, width: 300, height: coords.height }
      , focused: true
      , incognito: false
      , tabs: [ Chrome.newTabPath ] }

    windows <- liftEff do
      windows <- Chrome.windows state
      traceAnyA windows
      pure windows

    a <- traverse (\window -> do
      traceAnyA "CREATING"
      tab <- Chrome.createNewTab state { window, url: Chrome.newTabPath, index: Just 0, focused: false, pinned: true }
      traceAnyA "FOCUSING"
      Chrome.focusTab state tab
      --Chrome.changeTab { url: Nothing, pinned: Just true, focused: Nothing } tab
      ) (filter Chrome.windowIsNormal windows)

    traceAnyA "HIIIIIIIIIII"

    pure unit

    {-traverse_ (changeWindow { state: Just Maximized
                            , focused: Nothing
                            , drawAttention: Nothing }) a

    sleep 3000

    states <- traverse windowState a
    traceAnyA states

    traceAnyA a-}
