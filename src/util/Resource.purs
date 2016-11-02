module Pauan.Resource (Resource(..), cleanup) where

import Prelude
import Control.Monad.Eff (Eff)


newtype Resource = Resource (forall eff. Eff eff Unit)


cleanup :: forall eff. Resource -> Eff eff Unit
cleanup (Resource a) = a
