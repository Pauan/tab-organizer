module Pauan.View (class ToView, View, view, observe, value) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)


foreign import data View :: * -> *

foreign import value :: forall a eff. View a -> Eff eff a

foreign import observe :: forall a eff. (a -> Eff eff Unit) -> View a -> Eff eff Resource


class ToView f a where
  view :: f -> View a


foreign import mapImpl :: forall a b. (a -> b) -> View a -> View b

instance functorView :: Functor View where
  map = mapImpl


foreign import applyImpl :: forall a b. View (a -> b) -> View a -> View b

instance applyView :: Apply View where
  apply = applyImpl


foreign import bindImpl :: forall a b. View a -> (a -> View b) -> View b

instance bindView :: Bind View where
  bind = bindImpl


foreign import pureImpl :: forall a. a -> View a

instance applicativeView :: Applicative View where
  pure = pureImpl
