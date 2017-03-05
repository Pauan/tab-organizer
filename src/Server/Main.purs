module Server.Main where

import Pauan.Prelude
import Pauan.Chrome as Chrome


getMaximizedWindowCoordinates :: forall e. Chrome.WindowsState -> Aff (timer :: TIMER | e) Chrome.Coordinates
getMaximizedWindowCoordinates state = do
  win <- Chrome.makeNewWindow state
    { type: Chrome.Normal
    , state: Chrome.Maximized
    , focused: true
    , incognito: false
    , tabs: [ Chrome.resolvePath "data/empty.html" ] }
  -- TODO this probably isn't needed, but it's better safe than sorry
  sleep 500
  coords <- Chrome.windowCoordinates win
  Chrome.closeWindow state win
  pure coords


main :: Eff (err :: EXCEPTION, timer :: TIMER) Unit
main = mainAff do
  traceAnyA "initializing"
  state <- Chrome.initialize

  coords <- getMaximizedWindowCoordinates state
  traceAnyA coords

  a <- liftEff << Chrome.windows state
  traceAnyA a
  traceAnyA (filter Chrome.windowIsNormal a)

  traverse_ (Chrome.changeWindow { state: Just << Chrome.Regular { left: 300, top: coords.top, width: coords.width - 300, height: coords.height }
                                 , focused: Nothing
                                 , drawAttention: Nothing })
            (filter Chrome.windowIsNormal a)

  win <- Chrome.makeNewWindow state
    { type: Chrome.Popup
    , state: Chrome.Regular { left: coords.left, top: coords.top, width: 300, height: coords.height }
    , focused: true
    , incognito: false
    , tabs: [] }

  pure unit

  {-traverse_ (changeWindow { state: Just Maximized
                          , focused: Nothing
                          , drawAttention: Nothing }) a

  sleep 3000

  states <- traverse windowState a
  traceAnyA states

  traceAnyA a-}
