module Options.Main where

import Pauan.Prelude
import Control.Monad.Eff.Console (CONSOLE, log)
import Pauan.Mutable as Mutable
import Pauan.View (observe)

main :: Eff (mutable :: Mutable.MUTABLE, console :: CONSOLE) Unit
main = do
  a <- Mutable.make 1
  b <- Mutable.make 2
  c <- Mutable.make 3
  observe
    (\a -> show a >> log)
    (lift3 (\a b c -> a + b + c) (view a) (view b) (view c)) >> void
  runTransaction do
    a >> Mutable.set 20
  runTransaction do
    b >> Mutable.set 30
  runTransaction do
    c >> Mutable.set 40
  runTransaction do
    a >> Mutable.set 1
    b >> Mutable.set 2
    c >> Mutable.set 3
