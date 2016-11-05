module Pauan.View (class ToView, View, view, observe, value) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)


foreign import data View :: # ! -> * -> *

foreign import value :: forall a eff. View eff a -> Eff eff a

foreign import observe :: forall a eff. (a -> Eff eff Unit) -> View eff a -> Eff eff Resource


class ToView f a eff where
  view :: f -> View eff a


foreign import mapImpl :: forall a b eff. (a -> b) -> View eff a -> View eff b

instance functorView :: Functor (View eff) where
  map = mapImpl


foreign import applyImpl :: forall a b eff. View eff (a -> b) -> View eff a -> View eff b

instance applyView :: Apply (View eff) where
  apply = applyImpl


foreign import bindImpl :: forall a b eff. View eff a -> (a -> View eff b) -> View eff b

instance bindView :: Bind (View eff) where
  bind = bindImpl


foreign import pureImpl :: forall a eff. a -> View eff a

instance applicativeView :: Applicative (View eff) where
  pure = pureImpl
