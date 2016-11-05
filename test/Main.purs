module Test.Main where

import Pauan.Prelude.Test

import Pauan.Test.Events as Events
import Pauan.Test.Mutable as Mutable
import Pauan.Test.View as View
import Pauan.Test.Animation as Animation

main :: TestOutput
main = runTest do
  Events.tests
  Mutable.tests
  View.tests
  Animation.tests
