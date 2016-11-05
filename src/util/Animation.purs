module Pauan.Animation
  ( Animation
  , Tween(..)
  , make
  , jumpTo
  , tweenTo
  , range
  , rangeSuffix
  , easePow
  , easeSinusoidal
  , easeExponential
  , easeCircular
  , easeOut
  , easeInOut
  , easeRepeat
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Data.Foldable (sequence_)
import Pauan.View (class ToView, View, view)
import Pauan.Transaction (Transaction, runTransaction)
import Data.Generic (class Generic, gEq, gShow, gCompare)
import Pauan.Mutable as Mutable


foreign import data Animation :: *


newtype Tween = Tween Number

derive instance genericTween :: Generic Tween

-- TODO replace with Newtype or whatever
instance showTween :: Show Tween where
  show = gShow

instance eqTween :: Eq Tween where
  eq = gEq

instance ordTween :: Ord Tween where
  compare = gCompare


foreign import makeImpl :: forall eff.
  Eff (mutable :: Mutable.MUTABLE | eff) (Mutable.Mutable Tween) ->
  Number ->
  Eff (mutable :: Mutable.MUTABLE | eff) Animation

makeImpl' :: forall eff. Number -> Eff (mutable :: Mutable.MUTABLE | eff) Animation
makeImpl' = makeImpl (Mutable.make (Tween 0.0))

make :: forall eff.
  { duration :: Number } ->
  Eff (mutable :: Mutable.MUTABLE | eff) Animation
make x = makeImpl' x.duration


foreign import viewImpl :: forall eff.
  (Mutable.Mutable Tween -> View eff Tween) ->
  Animation ->
  View eff Tween

instance toViewAnimation :: ToView Animation Tween eff where
  view = viewImpl view


foreign import jumpToImpl :: forall eff.
  (Tween -> Mutable.Mutable Tween -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit) ->
  Number ->
  Animation ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit

jumpTo :: forall eff. Number -> Animation -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
jumpTo = jumpToImpl Mutable.set


foreign import tweenToImpl :: forall eff.
  (Tween -> Mutable.Mutable Tween -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit) ->
  (Array (Transaction eff Unit) -> Transaction eff Unit) ->
  (Transaction eff Unit -> Eff eff Unit) ->
  Unit ->
  Number ->
  Animation ->
  Eff (mutable :: Mutable.MUTABLE | eff) Unit

tweenTo :: forall eff. Number -> Animation -> Eff (mutable :: Mutable.MUTABLE | eff) Unit
tweenTo = tweenToImpl Mutable.set sequence_ runTransaction unit


foreign import rangeImpl :: Number -> Number -> Tween -> Number

range :: Number -> Number -> Tween -> Number
range = rangeImpl


rangeSuffix :: Number -> Number -> String -> Tween -> String
-- TODO should this use show or something else ?
rangeSuffix from to suffix t = show (range from to t) <> suffix


foreign import easePow :: Number -> Tween -> Tween

foreign import easeSinusoidal :: Tween -> Tween

foreign import easeExponential :: Tween -> Tween

foreign import easeCircular :: Tween -> Tween

foreign import easeOut :: (Tween -> Tween) -> Tween -> Tween

foreign import easeInOut :: (Tween -> Tween) -> Tween -> Tween

-- TODO should this be Int or Number ?
foreign import easeRepeat :: Int -> Tween -> Tween
