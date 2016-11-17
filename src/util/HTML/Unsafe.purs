module Pauan.HTML.Unsafe
  ( DOMElement
  , HTML
  , Event
  , State
  , Trait
  , class HTMLProperty
  , unsafeSetProperty
  , unsafeProperty
  , class HTMLStyle
  , unsafeSetStyle
  , class HTMLChild
  , unsafeAppendChild
  , class HTMLText
  , unsafeMakeText
  , beforeRemove
  , afterInsert
  , render'
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (View, observe)
import Pauan.Resource (Resource)
import Data.Function.Uncurried (Fn2, Fn3, Fn4)


-- TODO use purescript-dom
foreign import data DOMElement :: *

foreign import data Event :: *

foreign import data HTML :: *

foreign import data State :: *

foreign import data Trait :: *


type Observe eff a = (a -> Eff eff Unit) -> View a -> Eff eff Resource


type SetProperty a = Fn4 State DOMElement String a Unit

class HTMLProperty a b | a -> b where
  unsafeSetProperty :: SetProperty a


foreign import unsafeSetPropertyValue :: forall a. SetProperty a

instance htmlPropertyString :: HTMLProperty String String where
  unsafeSetProperty = unsafeSetPropertyValue

-- TODO a bit of code duplication
instance htmlPropertyBoolean :: HTMLProperty Boolean Boolean where
  unsafeSetProperty = unsafeSetPropertyValue


foreign import unsafeSetPropertyView :: forall eff a.
  Observe eff a ->
  Unit ->
  SetProperty (View a)

instance htmlPropertyView :: HTMLProperty (View a) a where
  unsafeSetProperty = unsafeSetPropertyView observe unit


foreign import unsafePropertyImpl :: forall a.
  SetProperty a ->
  String ->
  a ->
  Trait

unsafeProperty :: forall a b. (HTMLProperty a b) => String -> a -> Trait
unsafeProperty = unsafePropertyImpl unsafeSetProperty


class HTMLStyle a where
  unsafeSetStyle :: Fn4 State DOMElement String a Unit


foreign import unsafeSetStyleValue :: Fn4 State DOMElement String String Unit

instance htmlStyleValue :: HTMLStyle String where
  unsafeSetStyle = unsafeSetStyleValue


foreign import unsafeSetStyleView :: forall eff.
  Observe eff String ->
  Unit ->
  Fn4 State DOMElement String (View String) Unit

instance htmlStyleView :: HTMLStyle (View String) where
  unsafeSetStyle = unsafeSetStyleView observe unit


class HTMLText a where
  unsafeMakeText :: Fn2 State a DOMElement


foreign import makeTextString :: Fn2 State String DOMElement

instance htmlTextString :: HTMLText String where
  unsafeMakeText = makeTextString


foreign import makeTextView :: forall eff.
  Observe eff String ->
  Unit ->
  Fn2 State (View String) DOMElement

instance htmlTextView :: HTMLText (View String) where
  unsafeMakeText = makeTextView observe unit


class HTMLChild a where
  unsafeAppendChild :: Fn3 State DOMElement a Unit


foreign import appendChildArray :: Unit -> Fn3 State DOMElement (Array HTML) Unit

instance htmlChildArray :: HTMLChild (Array HTML) where
  unsafeAppendChild = appendChildArray unit


foreign import appendChildView :: forall eff.
  Observe eff (View (Array HTML)) ->
  Unit ->
  Fn3 State DOMElement (View (Array HTML)) Unit

instance htmlChildView :: HTMLChild (View (Array HTML)) where
  unsafeAppendChild = appendChildView observe unit


foreign import afterInsertImpl :: forall eff. Unit -> Eff eff Unit -> State -> Eff eff Unit

afterInsert :: forall eff. Eff eff Unit -> State -> Eff eff Unit
afterInsert = afterInsertImpl unit


foreign import beforeRemoveImpl :: forall eff. Unit -> Eff eff Unit -> State -> Eff eff Unit

beforeRemove :: forall eff. Eff eff Unit -> State -> Eff eff Unit
beforeRemove = beforeRemoveImpl unit


foreign import renderImpl :: forall eff. Unit -> DOMElement -> HTML -> Eff eff Resource

render' :: forall eff. DOMElement -> HTML -> Eff eff Resource
render' = renderImpl unit
