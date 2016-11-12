module Pauan.HTML
  ( module Exports
  , on
  , widget
  , html
  , text
  , style
  , body
  , trait
  , property
  , checked
  , sampleOn
  , render
  , hsl
  , hsla
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (View, value)
import Pauan.Resource (Resource)
import Data.Function.Uncurried (Fn2, Fn3, Fn4)

import Pauan.HTML.Unsafe
  ( Event
  , State
  , Trait
  , HTML
  , DOMElement
  , render'
  , class HTMLProperty
  , class HTMLStyle
  , class HTMLText
  , class HTMLChild
  , unsafeAppendChild
  , unsafeMakeText
  , unsafeSetStyle
  , unsafeProperty
  )

import Pauan.HTML.Unsafe
  ( DOMElement
  , HTML
  , Event
  , State
  , Trait
  , class HTMLProperty
  , class HTMLStyle
  , class HTMLChild
  , class HTMLText
  , beforeRemove
  , afterInsert
  , render'
  ) as Exports


foreign import onImpl :: forall eff.
  String ->
  (Event -> Eff eff Unit) ->
  Trait

on :: forall eff. String -> (Event -> Eff eff Unit) -> Trait
on = onImpl


foreign import widget :: forall eff. (State -> Eff eff HTML) -> HTML


foreign import htmlImpl :: forall a.
  (Fn3 State DOMElement a Unit) ->
  String ->
  Array Trait ->
  a ->
  HTML

html :: forall a. (HTMLChild a) => String -> Array Trait -> a -> HTML
html = htmlImpl unsafeAppendChild


foreign import textImpl :: forall a.
  (Fn2 State a DOMElement) ->
  a ->
  HTML

text :: forall a. (HTMLText a) => a -> HTML
text = textImpl unsafeMakeText


foreign import styleImpl :: forall a.
  (Fn4 State DOMElement String a Unit) ->
  String ->
  a ->
  Trait

style :: forall a. (HTMLStyle a) => String -> a -> Trait
style = styleImpl unsafeSetStyle


-- TODO should this return Eff ?
foreign import body :: forall eff. Eff eff DOMElement


property :: forall a. (HTMLProperty a String) => String -> a -> Trait
property = unsafeProperty

-- TODO what about indeterminacy ?
checked :: forall a. (HTMLProperty a Boolean) => a -> Trait
checked = unsafeProperty "checked"


foreign import trait :: Array Trait -> Trait


sampleOn :: forall eff a. String -> View a -> (Event -> a -> Eff eff Unit) -> Trait
sampleOn name view f =
  on name \e -> do
    v <- value view
    f e v


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
