module Pauan.Stream (Stream, class ToStream, stream, make, each, filter, merge, scanl) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)
import Data.Traversable (class Traversable, traverse_)
import Data.Function.Uncurried (Fn3, runFn3, mkFn3)


foreign import data Stream :: * -> * -> *


-- TODO move `f` to the end, so that newtype deriving works ?
class ToStream f e a | f -> e a where
  stream :: f -> Stream e a


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


foreign import makeImpl :: forall eff e a.
  (Fn3
    (a -> Eff eff Unit)
    (e -> Eff eff Unit)
    (Eff eff Unit)
    (Eff eff Resource)) ->
  Stream e a

make :: forall a e eff.
  ((a -> Eff eff Unit) ->
   (e -> Eff eff Unit) ->
   Eff eff Unit ->
   Eff eff Resource) ->
  Stream e a
make f = makeImpl (mkFn3 f)


foreign import eachImpl :: forall eff e a.
  (a -> Eff eff Unit) ->
  (e -> Eff eff Unit) ->
  Eff eff Unit ->
  Stream e a ->
  Eff eff Resource

each :: forall a e eff.
  (a -> Eff eff Unit) ->
  (e -> Eff eff Unit) ->
  Eff eff Unit ->
  Stream e a ->
  Eff eff Resource
each = eachImpl


foreign import mapImpl :: forall a b e. (a -> b) -> Stream e a -> Stream e b

instance functorStream :: Functor (Stream e) where
  map = mapImpl


foreign import filterImpl :: forall a e.
  Unit ->
  (a -> Boolean) ->
  Stream e a ->
  Stream e a

filter :: forall a e.
  (a -> Boolean) ->
  Stream e a ->
  Stream e a
filter = filterImpl unit


foreign import mergeImpl :: forall a e.
  Unit ->
  Stream e a ->
  Stream e a ->
  Stream e a

merge :: forall a e. Stream e a -> Stream e a -> Stream e a
merge = mergeImpl unit


foreign import scanlImpl :: forall a b e.
  (b -> a -> b) ->
  b ->
  Stream e a ->
  Stream e b

scanl :: forall a b e.
  (b -> a -> b) ->
  b ->
  Stream e a ->
  Stream e b
scanl = scanlImpl
