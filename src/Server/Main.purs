module Server.Main where

import Pauan.Prelude
import Pauan.Chrome as Chrome
import Pauan.Events as Events
import Pauan.Debug as Debug
import Control.Monad.Aff (attempt)
import Server.Test (runTests)


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


main = runTests


{-main :: Eff (err :: EXCEPTION, timer :: TIMER) Unit
main = do
  -- TODO have it change the badge color (or icon) rather than alerting
  Debug.onError Debug.alertError

  runAff do
    traceAnyA "initializing"
    state <- Chrome.initialize

    liftEff do
      windows <- Chrome.windows state
      traceAnyA windows

      stop <- Chrome.events state >> Events.receive \event ->
        traceAnyA event

      pure unit-}
