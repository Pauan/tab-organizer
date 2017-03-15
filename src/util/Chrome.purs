module Pauan.Chrome
  ( module Pauan.Chrome.Windows
  , module Pauan.Chrome.Util
  ) where

import Pauan.Chrome.Windows
  ( Window, Tab, WindowsState, Coordinates, initialize, windows
  , createNewWindow, changeWindow, WindowType(..), WindowState(..), windowInfo
  , WindowsEvent(..), windowIsPopup, closeWindow, windowIsNormal, events
  , createNewTab, changeTab, focusTab, windowTabs, closeTabs, moveTabs
  , tabUrl )

import Pauan.Chrome.Util (resolvePath, newTabPath)
