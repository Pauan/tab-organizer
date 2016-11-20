module Pauan.StreamArray
  ( StreamArray(..)
  , ArrayDelta(..)
  , class ToStreamArray
  , streamArray
  , arrayDelta
  , eachDelta
  ) where

import Prelude
import Data.Maybe (fromMaybe)
import Data.Array (insertAt, updateAt, deleteAt)
import Pauan.Stream (Stream, class ToStream, scanl, each)
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)


data ArrayDelta a
  = Replace (Array a)
  | Insert Int a
  | Update Int a
  | Remove Int


arrayDelta :: forall a b.
  (Array a -> b) ->
  (Int -> a -> b) ->
  (Int -> a -> b) ->
  (Int -> b) ->
  ArrayDelta a ->
  b
arrayDelta replace _ _ _ (Replace a) = replace a
arrayDelta _ insert _ _ (Insert i a) = insert i a
arrayDelta _ _ update _ (Update i a) = update i a
arrayDelta _ _ _ remove (Remove i)   = remove i


newtype StreamArray e a = StreamArray (Stream e (ArrayDelta a))


-- TODO move `f` to the end, so that newtype deriving works ?
class ToStreamArray f e a | f -> e a where
  streamArray :: f -> StreamArray e a


instance toStreamArray :: ToStream (StreamArray e a) e (Array a) where
  stream (StreamArray s) = scanl (\old delta ->
    case delta of
      Replace a -> a
      -- TODO is `fromMaybe` correct ?
      -- TODO throw an error if it is Nothing ?
      Insert i a -> fromMaybe old (insertAt i a old)
      Update i a -> fromMaybe old (updateAt i a old)
      Remove i -> fromMaybe old (deleteAt i old)) [] s


instance functorStream :: Functor (StreamArray e) where
  map f (StreamArray s) = StreamArray
    (map (\delta ->
      case delta of
        Replace a -> Replace (map f a)
        Insert i a -> Insert i (f a)
        Update i a -> Update i (f a)
        Remove i -> Remove i) s)


eachDelta :: forall e a eff.
  (ArrayDelta a -> Eff eff Unit) ->
  StreamArray e a ->
  Eff eff Resource
-- TODO handle errors better
eachDelta f (StreamArray s) = each f (const (pure unit)) (pure unit) s
