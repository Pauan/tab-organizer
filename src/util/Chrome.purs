module Pauan.Chrome
  ( module Pauan.Chrome.Windows
  , module Pauan.Chrome.Util
  ) where

import Pauan.Chrome.Windows (WindowsState, Coordinates, initialize, windows, createNewWindow, changeWindow, WindowType(..), WindowState(..), windowInfo, windowIsPopup, closeWindow, windowIsNormal, events, createNewTab, changeTab, focusTab, windowTabs, closeTabs)

import Pauan.Chrome.Util (resolvePath, newTabPath)
