module Pauan.HTML
  ( module Exports
  , on
  , widget
  , html
  , text
  , style
  , body
  , property
  , checked
  , sampleOn
  , render
  , hsl
  , hsla
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (value)
import Pauan.Resource (Resource)
import Data.Function.Uncurried (Fn2, Fn3, Fn4)

import Pauan.HTML.Unsafe
  ( Event
  , State
  , Adjective
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
  , Adjective
  , class HTMLProperty
  , unsafeSetProperty
  , class HTMLStyle
  , unsafeSetStyle
  , class HTMLChild
  , unsafeAppendChild
  , class HTMLText
  , unsafeMakeText
  , beforeRemove
  , afterInsert
  , render'
  ) as Exports


foreign import onImpl :: forall eff.
  String ->
  (Event -> Eff eff Unit) ->
  Adjective

on :: forall eff. String -> (Event -> Eff eff Unit) -> Adjective
on = onImpl


foreign import widget :: forall eff. (State -> Eff eff HTML) -> HTML


foreign import htmlImpl :: forall a.
  (Fn3 State DOMElement a Unit) ->
  String ->
  Array Adjective ->
  a ->
  HTML

html :: forall a. (HTMLChild a) => String -> Array Adjective -> a -> HTML
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
  Adjective

style :: forall a. (HTMLStyle a) => String -> a -> Adjective
style = styleImpl unsafeSetStyle


-- TODO should this return Eff ?
foreign import body :: forall eff. Eff eff DOMElement


property :: forall a. (HTMLProperty a String) => String -> a -> Adjective
property = unsafeProperty

-- TODO what about indeterminacy ?
checked :: forall a. (HTMLProperty a Boolean) => a -> Adjective
checked = unsafeProperty "checked"


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
