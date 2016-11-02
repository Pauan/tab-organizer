module Test.Main where

import Pauan.Prelude.Test
import Pauan.Test.Events as Events
import Pauan.Test.Mutable as Mutable

main :: TestOutput
main = runTest do
  Events.tests
  Mutable.tests
