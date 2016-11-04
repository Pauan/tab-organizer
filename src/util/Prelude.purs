module Pauan.Prelude
  ( module Prelude
  , module Control.Monad.Eff
  , module Control.Monad.Eff.Class
  , module Control.Monad.Aff
  , module Pauan.View
  , module Pauan.Transaction
  , (<<)
  , (>>)
  , (|<)
  , (>|)
  , applyFlipped
  ) where

import Prelude
  ( Unit
  , bind
  , show
  , (+)
  , (-)
  , negate
  , void
  , class Eq
  , class Show
  , pure
  , unit
  , map
  , apply
  , class Apply
  )

import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Class (liftEff)
import Control.Monad.Aff (Aff)

import Pauan.View (class ToView, View, view)
import Pauan.Transaction (Transaction, runTransaction)

import Data.Function as Function

applyFlipped :: forall a b c. (Apply a) => a b -> a (b -> c) -> a c
applyFlipped a b = apply b a

infixr 1 Function.apply as <<
infixl 1 Function.applyFlipped as >>

infixl 0 apply as |<
infixr 0 applyFlipped as >|