module Pauan.Panel.Types where

import Pauan.Prelude
import Pauan.Mutable as Mutable'
import Pauan.Mutable (Mutable, MUTABLE)
import Pauan.MutableArray (MutableArray)


type Group =
  { tabs :: MutableArray Tab }


type Tab =
  { url :: String
  , title :: String
  , top :: Mutable (Maybe Int)
  , matchedSearch :: Mutable Boolean
  , dragging :: Mutable Boolean
  , selected :: Mutable Boolean }


type Dragging =
  { left :: (Maybe Int)
  , width :: Int
  , height :: Int
  , offsetX :: Int
  , offsetY :: Int
  , selected :: Array Tab }


type State =
  { dragging :: Mutable (Maybe Dragging)
  , draggingPosition :: Mutable (Maybe DragEvent) }


makeState :: forall eff. Eff (mutable :: MUTABLE | eff) State
makeState = do
  dragging <- Mutable'.make Nothing
  draggingPosition <- Mutable'.make Nothing
  pure { dragging, draggingPosition }
