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
foreign import makeImpl :: forall a eff.
  Eff eff (Events.Events TransactionId) ->
  ((TransactionId -> Eff eff Unit) -> Events.Events TransactionId -> Eff eff Resource) ->
  Unit ->
  a ->
  Transaction (mutable :: MUTABLE | eff) (Mutable a)

make :: forall a eff. a -> Transaction (mutable :: MUTABLE | eff) (Mutable a)
make = makeImpl Events.make Events.receive unit


foreign import viewImpl :: forall a. Mutable a -> View a

instance toViewMutable :: ToView (Mutable a) a where
  view = viewImpl


foreign import get :: forall a eff. Mutable a -> Transaction (mutable :: MUTABLE | eff) a


foreign import setImpl :: forall a eff.
  -- TODO is this type signature correct ?
  (TransactionId -> Events.Events TransactionId -> Eff eff Unit) ->
  Unit ->
  a ->
  Mutable a ->
  Transaction (mutable :: MUTABLE | eff) Unit

set :: forall a eff. a -> Mutable a -> Transaction (mutable :: MUTABLE | eff) Unit
set = setImpl Events.send unit


modify :: forall a eff. (a -> a) -> Mutable a -> Transaction (mutable :: MUTABLE | eff) Unit
modify f mutable = do
  a <- get mutable
  set (f a) mutable
