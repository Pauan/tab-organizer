module Pauan.Chrome
  ( module Pauan.Chrome.Windows
  , module Pauan.Chrome.Util
  ) where

import Pauan.Chrome.Windows (WindowsState, Coordinates, initialize, windows, makeNewWindow, changeWindow, WindowType(..), WindowState(..), windowState, windowCoordinates, windowIsPopup, closeWindow, windowIsNormal)

import Pauan.Chrome.Util (resolvePath)
