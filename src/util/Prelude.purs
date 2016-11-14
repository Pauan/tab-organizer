module Pauan.Prelude
  ( module Prelude
  , module Control.Monad.Eff
  , module Control.Monad.Eff.Class
  , module Control.Monad.Aff
  , module Debug.Trace
  , module Pauan.View
  , module Pauan.Transaction
  , module Pauan.HTML
  , module Data.Array
  , module Data.Maybe
  , (<<)
  , (>>)
  , (|<)
  , (>|)
  , applyFlipped
  , ifJust
  , (++)
  ) where

import Prelude
  ( Unit
  , bind
  , show
  , (+)
  , (-)
  , (<<<)
  , (>>>)
  , id
  , negate
  , void
  , class Eq
  , class Show
  , pure
  , unit
  , map
  , apply
  , class Apply
  , Ordering(..)
  , (||)
  , (&&)
  , top
  , const
  )

import Data.Array ((..))
import Data.Maybe (Maybe(Nothing, Just), fromMaybe, isJust, maybe)
import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Class (liftEff)
import Control.Monad.Aff (Aff)
import Debug.Trace (spy)

import Pauan.View (class ToView, View, view)
import Pauan.Transaction (Transaction, runTransaction)

import Pauan.HTML
  ( HTML
  , html
  , style
  , hsl
  , hsla
  , text
  , on
  , onHoverSet
  , DragEvent
  , onDrag
  , onDragSet
  , onDragSet'
  , Trait
  , trait
  , property
  )

import Prelude as Prelude'
import Data.Function as Function'

applyFlipped :: forall a b c. (Apply a) => a b -> a (b -> c) -> a c
applyFlipped a b = apply b a

infixr 5 Prelude'.append as ++

infixr 1 Function'.apply as <<
infixl 1 Function'.applyFlipped as >>

infixl 0 Prelude'.apply as |<
infixr 0 applyFlipped as >|


ifJust :: forall a b. a -> a -> Maybe b -> a
ifJust yes _  (Just _) = yes
ifJust _   no Nothing = no
