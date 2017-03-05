module Server.Main where

import Pauan.Prelude
import Pauan.Chrome as Chrome

main :: Eff (err :: EXCEPTION, timer :: TIMER) Unit
main = mainAff do
  traceAnyA "initializing"
  state <- Chrome.initialize

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  coords <- Chrome.getMaximizedWindowCoordinates state
  traceAnyA coords

  a <- liftEff << Chrome.windows state
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
