module Pauan.Chrome
  ( module Pauan.Chrome.Windows
  ) where

import Pauan.Chrome.Windows (initialize, windows, makeNewWindow, changeWindow, WindowType(..), WindowState(..), windowState, windowCoordinates, windowIsPopup, closeWindow, getMaximizedWindowCoordinates, windowIsNormal)
