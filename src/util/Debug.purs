module Pauan.Debug (onError, alertError) where

import Prelude
import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Exception (Error)


foreign import onErrorImpl :: forall eff. Unit -> (Error -> Eff eff Unit) -> Eff eff Unit

foreign import alertErrorImpl :: forall eff. Unit -> Error -> Eff eff Unit

onError :: forall eff. (Error -> Eff eff Unit) -> Eff eff Unit
onError = onErrorImpl unit

alertError :: forall eff. Error -> Eff eff Unit
alertError = alertErrorImpl unit
