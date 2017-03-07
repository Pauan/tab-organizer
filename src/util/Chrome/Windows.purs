module Pauan.Chrome.Windows where

import Prelude
import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Exception (Error)
import Control.Monad.Aff (Aff, makeAff)
import Data.Maybe (Maybe(..))
import Data.Nullable (Nullable, toNullable)
import Data.Function.Uncurried (Fn10, runFn10)
import Pauan.Events as Events


foreign import data WindowsState :: *

foreign import data Window :: *

foreign import data Tab :: *


data WindowsEvent
  = WindowCreated { window :: Window, index :: Int }
  | WindowClosed { window :: Window, index :: Int }
  | WindowFocused { window :: Window }
  | WindowUnfocused { window :: Window }

  | TabCreated { tab :: Tab, window :: Window, index :: Int }
  | TabClosed { tab :: Tab, window :: Window, index :: Int }
  | TabFocused { tab :: Tab }
  | TabUnfocused { tab :: Tab }
  | TabMovedInSameWindow { tab :: Tab, window :: Window, oldIndex :: Int, newIndex :: Int }
  | TabMovedToOtherWindow { tab :: Tab, oldWindow :: Window, newWindow :: Window, oldIndex :: Int, newIndex :: Int }
  | TabChanged { tab :: Tab }


foreign import initializeImpl :: forall e.
  Unit ->
  (((Error -> Eff e Unit) -> (WindowsState -> Eff e Unit) -> Eff e Unit) -> Aff e WindowsState) ->
  Eff e (Events.Broadcaster WindowsEvent) ->
  (WindowsEvent -> Events.Broadcaster WindowsEvent -> Eff e Unit) ->

  (Window -> Int -> WindowsEvent) ->
  (Window -> Int -> WindowsEvent) ->
  (Window -> WindowsEvent) ->
  (Window -> WindowsEvent) ->

  (Tab -> Window -> Int -> WindowsEvent) ->
  (Tab -> Window -> Int -> WindowsEvent) ->
  (Tab -> WindowsEvent) ->
  (Tab -> WindowsEvent) ->
  (Tab -> Window -> Int -> Int -> WindowsEvent) ->
  (Tab -> Window -> Window -> Int -> Int -> WindowsEvent) ->
  (Tab -> WindowsEvent) ->

  Aff e WindowsState

initialize :: forall e. Aff e WindowsState
initialize = initializeImpl
  unit
  makeAff
  Events.makeBroadcaster
  Events.broadcast

  (\window index -> WindowCreated { window, index })
  (\window index -> WindowClosed { window, index })
  (\window -> WindowFocused { window })
  (\window -> WindowUnfocused { window })

  (\tab window index -> TabCreated { tab, window, index })
  (\tab window index -> TabClosed { tab, window, index })
  (\tab -> TabFocused { tab })
  (\tab -> TabUnfocused { tab })
  (\tab window oldIndex newIndex -> TabMovedInSameWindow { tab, window, oldIndex, newIndex })
  (\tab oldWindow newWindow oldIndex newIndex -> TabMovedToOtherWindow { tab, oldWindow, newWindow, oldIndex, newIndex })
  (\tab -> TabChanged { tab })


foreign import eventsImpl ::
  (Events.Broadcaster WindowsEvent -> Events.Events WindowsEvent) ->
  WindowsState ->
  Events.Events WindowsEvent

events :: WindowsState -> Events.Events WindowsEvent
events = eventsImpl Events.events


foreign import windows :: forall e. WindowsState -> Eff e (Array Window)

foreign import windowId :: Window -> Int

foreign import windowIsIncognito :: Window -> Boolean

foreign import windowIsFocused :: forall e. Window -> Eff e Boolean

foreign import windowTabs :: forall e. Window -> Eff e (Array Tab)


type Coordinates =
  { left :: Int
  , top :: Int
  , width :: Int
  , height :: Int }

data WindowState
  = Regular Coordinates
  | Docked Coordinates
  | Minimized
  | Maximized
  | Fullscreen

windowStateToString :: WindowState -> String
windowStateToString (Regular _) = "normal"
windowStateToString (Docked _) = "docked"
windowStateToString Minimized = "minimized"
windowStateToString Maximized = "maximized"
windowStateToString Fullscreen = "fullscreen"

windowStateToCoordinates :: WindowState -> Maybe Coordinates
windowStateToCoordinates (Regular a) = Just a
windowStateToCoordinates (Docked a) = Just a
windowStateToCoordinates _ = Nothing


foreign import windowStateImpl :: forall e.
  Unit ->
  (((Error -> Eff e Unit) -> (WindowState -> Eff e Unit) -> Eff e Unit) -> Aff e WindowState) ->
  (Int -> Int -> Int -> Int -> WindowState) ->
  (Int -> Int -> Int -> Int -> WindowState) ->
  WindowState ->
  WindowState ->
  WindowState ->
  Window ->
  Aff e WindowState

windowState :: forall e. Window -> Aff e WindowState
windowState = windowStateImpl unit makeAff
  (\left top width height -> Regular { left, top, width, height })
  (\left top width height -> Docked { left, top, width, height })
  Minimized
  Maximized
  Fullscreen


foreign import windowCoordinatesImpl :: forall e.
  Unit ->
  (((Error -> Eff e Unit) -> (Coordinates -> Eff e Unit) -> Eff e Unit) -> Aff e Coordinates) ->
  (Int -> Int -> Int -> Int -> Coordinates) ->
  Window ->
  Aff e Coordinates

windowCoordinates :: forall e. Window -> Aff e Coordinates
windowCoordinates = windowCoordinatesImpl unit makeAff { left: _, top: _, width: _, height: _ }


foreign import closeWindowImpl :: forall e.
  Unit ->
  (((Error -> Eff e Unit) -> (Unit -> Eff e Unit) -> Eff e Unit) -> Aff e Unit) ->
  WindowsState ->
  Window ->
  Aff e Unit

closeWindow :: forall e. WindowsState -> Window -> Aff e Unit
closeWindow = closeWindowImpl unit makeAff


foreign import createNewWindowImpl :: forall e.
  Unit ->
  (((Error -> Eff e Unit) -> (Unit -> Eff e Unit) -> Eff e Unit) -> Aff e Unit) ->
  String ->
  String ->
  Nullable Int ->
  Nullable Int ->
  Nullable Int ->
  Nullable Int ->
  Boolean ->
  Boolean ->
  Array String ->
  WindowsState ->
  Aff e Window

createNewWindow :: forall e.
  WindowsState ->
  { type :: WindowType
  , state :: WindowState
  , focused :: Boolean
  , incognito :: Boolean
  , tabs :: Array String } ->
  Aff e Window
createNewWindow state info =
  createNewWindowImpl
    unit
    makeAff
    (windowTypeToString info.type)
    (windowStateToString info.state)
    -- TODO make this faster
    (toNullable $ map _.left coords)
    (toNullable $ map _.top coords)
    (toNullable $ map _.width coords)
    (toNullable $ map _.height coords)
    info.focused
    info.incognito
    info.tabs
    state
  where
    coords = windowStateToCoordinates info.state


foreign import changeWindowImpl :: forall e. Fn10
  Unit
  (((Error -> Eff e Unit) -> (Unit -> Eff e Unit) -> Eff e Unit) -> Aff e Unit)
  (Nullable String)
  (Nullable Int)
  (Nullable Int)
  (Nullable Int)
  (Nullable Int)
  (Nullable Boolean)
  (Nullable Boolean)
  Window
  (Aff e Unit)

changeWindow :: forall e.
  { state :: Maybe WindowState
  , focused :: Maybe Boolean
  , drawAttention :: Maybe Boolean } ->
  Window ->
  Aff e Unit
changeWindow info window =
  runFn10 changeWindowImpl
    unit
    makeAff
    (toNullable $ map windowStateToString info.state)
    -- TODO make this faster
    (toNullable $ map _.left coords)
    (toNullable $ map _.top coords)
    (toNullable $ map _.width coords)
    (toNullable $ map _.height coords)
    (toNullable info.focused)
    (toNullable info.drawAttention)
    window
  where
    -- TODO make this faster
    coords = bind info.state windowStateToCoordinates


data WindowType = Normal | Popup

windowTypeToString :: WindowType -> String
windowTypeToString Normal = "normal"
windowTypeToString Popup = "popup"


foreign import windowTypeImpl :: WindowType -> WindowType -> Window -> WindowType

windowType :: Window -> WindowType
windowType = windowTypeImpl Normal Popup


windowIsNormal :: Window -> Boolean
windowIsNormal window =
  case windowType window of
    Normal -> true
    _ -> false


windowIsPopup :: Window -> Boolean
windowIsPopup window =
  case windowType window of
    Popup -> true
    _ -> false


foreign import tabId :: forall e. Tab -> Eff e Int

foreign import tabIsFocused :: forall e. Tab -> Eff e Boolean

foreign import tabIsPinned :: forall e. Tab -> Eff e Boolean

foreign import tabIsAudible :: forall e. Tab -> Eff e Boolean

foreign import tabIsDiscarded :: forall e. Tab -> Eff e Boolean

foreign import tabCanAutoDiscard :: forall e. Tab -> Eff e Boolean

foreign import tabIsIncognito :: Tab -> Boolean


foreign import tabIndexImpl :: forall e.
  (Int -> Maybe Int) ->
  Maybe Int ->
  Tab ->
  Eff e (Maybe Int)

tabIndex :: forall e. Tab -> Eff e (Maybe Int)
tabIndex = tabIndexImpl Just Nothing


foreign import tabUrlImpl :: forall e.
  (String -> Maybe String) ->
  Maybe String ->
  Tab ->
  Eff e (Maybe String)

tabUrl :: forall e. Tab -> Eff e (Maybe String)
tabUrl = tabUrlImpl Just Nothing


foreign import tabTitleImpl :: forall e.
  (String -> Maybe String) ->
  Maybe String ->
  Tab ->
  Eff e (Maybe String)

tabTitle :: forall e. Tab -> Eff e (Maybe String)
tabTitle = tabTitleImpl Just Nothing


foreign import tabFaviconUrlImpl :: forall e.
  (String -> Maybe String) ->
  Maybe String ->
  Tab ->
  Eff e (Maybe String)

tabFaviconUrl :: forall e. Tab -> Eff e (Maybe String)
tabFaviconUrl = tabFaviconUrlImpl Just Nothing


data TabStatus = Loading | Complete

foreign import tabStatusImpl :: forall e.
  TabStatus ->
  TabStatus ->
  Tab ->
  Eff e TabStatus

tabStatus :: forall e. Tab -> Eff e TabStatus
tabStatus = tabStatusImpl Loading Complete
