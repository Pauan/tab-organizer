module Pauan.Prelude.Test
  ( module Pauan.Prelude
  , module Test.Unit
  , module Test.Unit.Assert
  , module Test.Unit.Main
  , module Test.Unit.QuickCheck
  , module Test.QuickCheck
  , Push
  , makePush
  , runPush
  , unsafeRunPush
  , getPush
  , equalPush
  , equalView
  , Tests
  , TestAff
  , TestEff
  , toTest
  , testUnit
  , TestOutput
  ) where

import Pauan.Prelude
import Control.Monad.Eff.Console (CONSOLE)
import Control.Monad.Aff.AVar (AVAR)
import Control.Monad.Eff.Unsafe (unsafePerformEff)
import Test.Unit (suite, test, TestSuite, failure)
import Test.Unit.Assert (equal)
import Test.Unit.Console (TESTOUTPUT)
import Test.Unit.Main (runTest)
import Test.Unit.QuickCheck (quickCheck)
import Test.QuickCheck ((===))
import Control.Monad.Eff.Random (RANDOM)

import Pauan.Mutable as Mutable
import Data.Array (snoc)


type TestAff a =
  Aff (
    mutable :: Mutable.MUTABLE,
    random :: RANDOM,
    console :: CONSOLE,
    testOutput :: TESTOUTPUT,
    avar :: AVAR
  ) a

type TestEff a =
  Eff (
    mutable :: Mutable.MUTABLE,
    random :: RANDOM,
    console :: CONSOLE,
    testOutput :: TESTOUTPUT,
    avar :: AVAR
  ) a

type Tests =
  TestSuite (
    mutable :: Mutable.MUTABLE,
    random :: RANDOM,
    console :: CONSOLE,
    testOutput :: TESTOUTPUT,
    avar :: AVAR
  )

type TestOutput = TestEff Unit


-- TODO use a newtype for this ?
type Push a = Mutable.Mutable (Array a)


makePush :: forall a eff.
  Aff (mutable :: Mutable.MUTABLE | eff) (Push a)
makePush = Mutable.make [] >> runTransaction >> liftEff


runPush :: forall a eff.
  Push a ->
  a ->
  Eff (mutable :: Mutable.MUTABLE | eff) Unit
runPush var value = runTransaction do
  var >> Mutable.modify \a -> value >> snoc a


unsafeRunPush :: forall a. Push a -> a -> a
unsafeRunPush var value = unsafePerformEff do
  runPush var value
  pure value


getPush :: forall a eff.
  Push a ->
  Aff (mutable :: Mutable.MUTABLE | eff) (Array a)
getPush var = liftEff << runTransaction do
  var >> Mutable.get


equalPush :: forall a eff. (Eq a, Show a) =>
  Array a ->
  Push a ->
  Aff (mutable :: Mutable.MUTABLE | eff) Unit
equalPush expected var = do
  output <- getPush var
  output >> equal expected


equalView :: forall a. (Eq a, Show a) => a -> View a -> TestAff Unit
equalView expected a = do
  actual <- a >> currentValue >> runTransaction >> toTest
  actual >> equal expected


toTest :: forall a. TestEff a -> TestAff a
toTest = liftEff


-- TODO use Data.Eq.Unsafe instead
foreign import unsafeEq :: forall a. a -> a -> Boolean

testUnit :: TestEff Unit -> TestAff Unit
testUnit a = do
  x <- toTest a
  x >> unsafeEq unit >> equal true
