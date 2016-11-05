module Pauan.HTML
  ( DOMElement
  , HTML
  , State
  , Attribute
  , widget
  , html
  , attribute
  , render
  , body
  , value
  , valueView
  , checked
  , checkedView
  , style
  , styleView
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (View, observe)
import Pauan.Resource (Resource)


type Observe eff a = (a -> Eff eff Unit) -> View eff a -> Eff eff Resource


-- TODO use purescript-dom
foreign import data DOMElement :: *

foreign import data HTML :: *

foreign import data State :: *

foreign import data Attribute :: *


foreign import widget :: forall eff. (State -> Eff eff HTML) -> HTML

foreign import html :: String -> Array Attribute -> Array HTML -> HTML

foreign import attribute :: String -> String -> Attribute


{-foreign import attributeViewImpl :: forall eff.
  Observe (Maybe String) ->
  Unit ->
  String ->
  View eff (Maybe String) ->
  Attribute

attributeView :: forall eff. String -> View eff (Maybe String) -> Attribute
attributeView = attributeViewImpl observe unit-}


foreign import value :: String -> Attribute

foreign import valueViewImpl :: forall eff.
  Observe eff String ->
  Unit ->
  View eff String ->
  Attribute

valueView :: forall eff. View eff String -> Attribute
valueView = valueViewImpl observe unit


-- TODO what about indeterminacy ?
foreign import checked :: Boolean -> Attribute

foreign import checkedViewImpl :: forall eff.
  Observe eff Boolean ->
  Unit ->
  View eff Boolean ->
  Attribute

checkedView :: forall eff. View eff Boolean -> Attribute
checkedView = checkedViewImpl observe unit


foreign import style :: String -> String -> Attribute

foreign import styleViewImpl :: forall eff.
  Observe eff String ->
  Unit ->
  String ->
  View eff String ->
  Attribute

styleView :: forall eff. String -> View eff String -> Attribute
styleView = styleViewImpl observe unit


foreign import renderImpl :: forall eff. Unit -> DOMElement -> HTML -> Eff eff Resource

render' :: forall eff. DOMElement -> HTML -> Eff eff Resource
render' = renderImpl unit


-- TODO should this return Eff ?
foreign import body :: forall eff. Eff eff DOMElement


render :: forall eff. HTML -> Eff eff Resource
render a = do
  b <- body
  render' b a
