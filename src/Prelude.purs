module Pauan.Prelude
  ( module Prelude
  , module Control.Monad.Eff
  , module Control.Monad.Eff.Class
  , module Control.Monad.Aff
  , module Debug.Trace
  , module Pauan.View
  , module Pauan.Stream
  , module Pauan.StreamArray
  , module Pauan.Transaction
  , module Pauan.HTML
  , module Data.Array
  , module Data.Maybe
  , module Data.Foldable
  , module Data.Traversable
  , module Pauan.Math
  , module Data.Int
  , (<<)
  , (>>)
  , (|<)
  , (>|)
  , applyFlipped
  , ifJust
  , (++)
  , mapIf
  , mapIfTrue
  ) where

import Prelude
  ( Unit
  , bind
  , show
  , (+)
  , (-)
  , (*)
  , (/)
  , (<<<)
  , (>>>)
  , min
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
  , (==)
  , (/=)
  , (<)
  , (>)
  , (>=)
  , (<=)
  , not
  , top
  , const
  )

import Data.Traversable (sequence)
import Data.Foldable (for_)
import Data.Array ((..), length, filterM)
import Data.Maybe (Maybe(Nothing, Just), fromMaybe, isJust, maybe)
import Data.Int (toNumber, round)
import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Class (liftEff)
import Control.Monad.Aff (Aff)
import Debug.Trace (spy)

import Pauan.Stream (Stream, class ToStream, stream)
import Pauan.StreamArray (StreamArray, class ToStreamArray, streamArray)
import Pauan.View (View, class ToView, view)
import Pauan.Transaction (Transaction, runTransaction)
import Pauan.Math (hypot)

import Pauan.HTML
  ( HTML
  , html
  , style
  , styleImportant
  , hsl
  , hsla
  , text
  , on
  , onHoverSet
  , DragEvent
  , DOMPosition
  , onDrag
  , Trait
  , trait
  , property
  , topZIndex
  , floating
  , hidden
  )

import Prelude as Prelude'
import Data.Function as Function'
import Data.Monoid as Monoid'

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


mapIf :: forall a f. (Prelude'.Functor f) => a -> a -> f Boolean -> f a
mapIf yes no = map (\a -> if a then yes else no)


-- TODO should this use mempty or something else ?
mapIfTrue :: forall a f. (Monoid'.Monoid a, Prelude'.Functor f) => a -> f Boolean -> f a
mapIfTrue yes = mapIf yes Monoid'.mempty


{- TODO
flip :: forall a b c. a -> (b -> a -> c) -> b -> c
flip a f b = f b a
-}
