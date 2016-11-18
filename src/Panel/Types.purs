module Pauan.Panel.Types where

import Pauan.Prelude
import Pauan.Mutable as Mutable


type Group =
  { tabs :: Mutable.Mutable (Array Tab) }


type Tab =
  { url :: String
  , title :: String
  , top :: Mutable.Mutable (Maybe Int)
  , visible :: Mutable.Mutable Boolean
  , selected :: Mutable.Mutable Boolean }


type Dragging =
  { left :: (Maybe Int)
  , width :: Int
  , height :: Int
  , offsetX :: Int
  , offsetY :: Int
  , selected :: Array Tab }


type State =
  { dragging :: Mutable.Mutable (Maybe Dragging)
  , draggingPosition :: Mutable.Mutable (Maybe DragEvent) }


makeState :: Eff (mutable :: Mutable.MUTABLE) State
makeState = do
  dragging <- Mutable.make Nothing
  draggingPosition <- Mutable.make Nothing
  pure { dragging, draggingPosition }
