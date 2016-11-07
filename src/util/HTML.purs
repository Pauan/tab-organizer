module Pauan.HTML
  ( DOMElement
  , HTML
  , State
  , Attribute
  , widget
  , html
  , htmlView
  , text
  , textView
  , attribute
  , render
  , body
  , value
  , valueView
  , checked
  , checkedView
  , MouseEvent
  , style
  , styleView
  , onClick
  , afterInsert
  , beforeRemove
  , hsl
  , hsla
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (View, observe)
import Pauan.Resource (Resource)


type Observe eff a = (a -> Eff eff Unit) -> View a -> Eff eff Resource


-- TODO use purescript-dom
foreign import data DOMElement :: *

foreign import data HTML :: *

foreign import data State :: *

foreign import data Attribute :: *


foreign import widget :: forall eff. (State -> Eff eff HTML) -> HTML

foreign import html :: String -> Array Attribute -> Array HTML -> HTML

foreign import attribute :: String -> String -> Attribute

foreign import text :: String -> HTML


foreign import htmlViewImpl :: forall eff.
  Observe eff (Array HTML) ->
  Unit ->
  String ->
  Array Attribute ->
  View (Array HTML) -> HTML

htmlView :: String -> Array Attribute -> View (Array HTML) -> HTML
htmlView = htmlViewImpl observe unit


foreign import textViewImpl :: forall eff.
  Observe eff String ->
  Unit ->
  View String -> HTML

textView :: View String -> HTML
textView = textViewImpl observe unit


type MouseEvent = {}

foreign import onClickImpl :: forall eff. (MouseEvent -> Eff eff Unit) -> Attribute

onClick :: forall eff. (MouseEvent -> Eff eff Unit) -> Attribute
onClick = onClickImpl


foreign import afterInsertImpl :: forall eff. Unit -> Eff eff Unit -> State -> Eff eff Unit

afterInsert :: forall eff. Eff eff Unit -> State -> Eff eff Unit
afterInsert = afterInsertImpl unit


foreign import beforeRemoveImpl :: forall eff. Unit -> Eff eff Unit -> State -> Eff eff Unit

beforeRemove :: forall eff. Eff eff Unit -> State -> Eff eff Unit
beforeRemove = beforeRemoveImpl unit


{-foreign import attributeViewImpl :: forall eff.
  Observe eff (Maybe String) ->
  Unit ->
  String ->
  View (Maybe String) ->
  Attribute

attributeView :: String -> View (Maybe String) -> Attribute
attributeView = attributeViewImpl observe unit-}


foreign import value :: String -> Attribute

foreign import valueViewImpl :: forall eff.
  Observe eff String ->
  Unit ->
  View String ->
  Attribute

valueView :: View String -> Attribute
valueView = valueViewImpl observe unit


-- TODO what about indeterminacy ?
foreign import checked :: Boolean -> Attribute

foreign import checkedViewImpl :: forall eff.
  Observe eff Boolean ->
  Unit ->
  View Boolean ->
  Attribute

checkedView :: View Boolean -> Attribute
checkedView = checkedViewImpl observe unit


foreign import style :: String -> String -> Attribute

foreign import styleViewImpl :: forall eff.
  Observe eff String ->
  Unit ->
  String ->
  View String ->
  Attribute

styleView :: String -> View String -> Attribute
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


hsl :: Number -> Number -> Number -> String
-- TODO should this use show ?
hsl h s l = "hsl(" <> show h <> ", " <> show s <> "%, " <> show l <> "%)"


hsla :: Number -> Number -> Number -> Number -> String
-- TODO should this use show ?
hsla h s l a = "hsl(" <> show h <> ", " <> show s <> "%, " <> show l <> "%, " <> show a <> ")"
