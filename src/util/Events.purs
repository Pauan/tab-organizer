module Pauan.Events (Events, make, send, receive) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)


foreign import data Events :: * -> *

foreign import make :: forall a eff. Eff eff (Events a)


foreign import sendImpl :: forall a eff. Unit -> a -> Events a -> Eff eff Unit

send :: forall a eff. a -> Events a -> Eff eff Unit
send = sendImpl unit


foreign import receiveImpl :: forall a eff. Unit -> (a -> Eff eff Unit) -> Events a -> Eff eff Resource

receive :: forall a eff. (a -> Eff eff Unit) -> Events a -> Eff eff Resource
receive = receiveImpl unit
