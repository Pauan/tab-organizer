module Pauan.Mutable (MUTABLE, Mutable, make, get, set, modify) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (class ToView, View)
import Pauan.Events as Events
import Pauan.Transaction (Transaction, TransactionId)
import Pauan.Resource (Resource)


foreign import data MUTABLE :: !

foreign import data Mutable :: * -> *

-- TODO Should this have an effect of MUTABLE ?
-- TODO what should it use for the effect type of Events ?
foreign import makeImpl :: forall a eff. Eff eff (Events.Events TransactionId) -> a -> Eff (mutable :: MUTABLE | eff) (Mutable a)

make :: forall a eff. a -> Eff (mutable :: MUTABLE | eff) (Mutable a)
make = makeImpl Events.make


foreign import viewImpl :: forall a eff.
  ((TransactionId -> Eff eff Unit) -> Events.Events TransactionId -> Eff eff Resource) ->
  Unit ->
  Mutable a ->
  View eff a

instance toViewMutable :: ToView Mutable eff where
  view = viewImpl Events.receive unit


foreign import get :: forall a eff. Mutable a -> Transaction (mutable :: MUTABLE | eff) a


foreign import setImpl :: forall a eff.
  -- TODO is this type signature correct ?
  (TransactionId -> Events.Events TransactionId -> Eff eff Unit) ->
  a ->
  Mutable a ->
  Transaction (mutable :: MUTABLE | eff) Unit

set :: forall a eff. a -> Mutable a -> Transaction (mutable :: MUTABLE | eff) Unit
set = setImpl Events.send


modify :: forall a eff. (a -> a) -> Mutable a -> Transaction (mutable :: MUTABLE | eff) Unit
modify f mutable = do
  a <- get mutable
  set (f a) mutable
