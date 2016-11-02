module Pauan.Prelude
  ( module Prelude
  , module Control.Monad.Eff
  , module Control.Monad.Eff.Class
  , module Control.Monad.Aff
  , module Control.Apply
  , module Pauan.View
  , module Pauan.Transaction
  , (<<)
  , (>>)
  ) where

import Prelude (Unit, bind, show, (+), void, class Eq, class Show, pure, unit)
import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Class (liftEff)
import Control.Monad.Aff (Aff)
import Control.Apply (lift3)

import Pauan.View (class ToView, View, view)
import Pauan.Transaction (Transaction, runTransaction)

import Data.Function (apply, applyFlipped)
infixr 0 apply as <<
infixl 1 applyFlipped as >>
