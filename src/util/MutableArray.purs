module Pauan.MutableArray (MutableArray, make, get, set) where -- , insertAt, updateAt, deleteAt

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Stream as Stream
import Pauan.StreamArray (ArrayDelta(..), class ToStreamArray, StreamArray(..))
import Pauan.Mutable as Mutable
import Pauan.Events as Events
import Pauan.Transaction (Transaction, onCommit, runTransaction)


data MutableArray a =
  MutableArray (Mutable.Mutable (Array a)) (Events.Events (ArrayDelta a))


instance toStreamArrayMutableArray :: ToStreamArray (MutableArray a) e a where
  streamArray (MutableArray mut events) = StreamArray
   (Stream.make \onValue _ _ -> do
      -- TODO make this faster ?
      value <- runTransaction (Mutable.get mut)
      onValue (Replace value)
      Events.receive onValue events)


make :: forall a eff. Array a -> Eff (mutable :: Mutable.MUTABLE | eff) (MutableArray a)
make value = do
  mutable <- Mutable.make value
  events <- Events.make
  pure (MutableArray mutable events)


get :: forall a eff. MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) (Array a)
get (MutableArray mut _) = Mutable.get mut


set :: forall a eff. Array a -> MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
set value (MutableArray mut events) = do
  Mutable.set value mut
  onCommit (Events.send (Replace value) events)
