module Pauan.Stream (Stream, class ToStream, stream, make, each, filter, merge, scanl) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)
import Data.Traversable (class Traversable, traverse_)
import Data.Function.Uncurried (Fn3, runFn3, mkFn3)


newtype Stream eff e a = Stream
  (Fn3
    (a -> Eff eff Unit)
    (e -> Eff eff Unit)
    (Eff eff Unit)
    (Eff eff Resource))


-- TODO move `f` to the end, so that newtype deriving works ?
class ToStream f eff e a | f -> eff e a where
  stream :: f -> Stream eff e a


{-foreign import streamArrayImpl :: forall eff e a. Unit -> Array a -> Stream eff e a

instance toStreamArray :: ToStream (Array a) eff e a where
  stream = streamArrayImpl unit-}


{-foreign import streamTraverseImpl :: forall eff e a t.
  Unit ->
  ((a -> Eff eff Unit) -> t a -> Eff eff Unit) ->
  t a ->
  Stream eff e a

-- TODO somehow use Foldable instead ?
-- TODO this should not traverse Arrays from right-to-left
instance toStreamTraversable :: (Traversable t) => ToStream (t a) eff e a where
  stream = streamTraverseImpl unit traverse_-}


make :: forall a e eff.
  ((a -> Eff eff Unit) ->
   (e -> Eff eff Unit) ->
   Eff eff Unit ->
   Eff eff Resource) ->
  Stream eff e a
make f = Stream (mkFn3 f)


each :: forall a e eff.
  (a -> Eff eff Unit) ->
  (e -> Eff eff Unit) ->
  Eff eff Unit ->
  Stream eff e a ->
  Eff eff Resource
each a b c (Stream s) = runFn3 s a b c


foreign import mapImpl :: forall a b e eff. (a -> b) -> Stream eff e a -> Stream eff e b

instance functorStream :: Functor (Stream eff e) where
  map = mapImpl


foreign import filterImpl :: forall a e eff.
  Unit ->
  (a -> Boolean) ->
  Stream eff e a ->
  Stream eff e a

filter :: forall a e eff.
  (a -> Boolean) ->
  Stream eff e a ->
  Stream eff e a
filter = filterImpl unit


foreign import mergeImpl :: forall a e eff.
  Unit ->
  Stream eff e a ->
  Stream eff e a ->
  Stream eff e a

merge :: forall a e eff. Stream eff e a -> Stream eff e a -> Stream eff e a
merge = mergeImpl unit


foreign import scanlImpl :: forall a b e eff.
  (b -> a -> b) ->
  b ->
  Stream eff e a ->
  Stream eff e b

scanl :: forall a b e eff.
  (b -> a -> b) ->
  b ->
  Stream eff e a ->
  Stream eff e b
scanl = scanlImpl
