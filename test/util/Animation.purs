module Pauan.Test.Animation where

import Pauan.Prelude.Test
import Pauan.Animation (Interval(..), easePow, easeExponential, easeSinusoidal, easeCircular, easeOut, easeInOut, easeRepeat)

testBeginEnd :: (Interval -> Interval) -> TestAff Unit
testBeginEnd f = do
  f (Interval 0.0) >> equal (Interval 0.0)
  f (Interval 1.0) >> equal (Interval 1.0)

testEasing :: (Interval -> Interval) -> TestAff Unit
testEasing f = do
  testBeginEnd f
  testBeginEnd (easeOut f)
  testBeginEnd (easeInOut f)

  quickCheck \a ->
    (easeRepeat a >>> f) (Interval 0.0) === (Interval 0.0)

  quickCheck \a ->
    (easeRepeat a >>> f) (Interval 1.0) === (Interval 1.0)

  quickCheck \a ->
    (f >>> easeRepeat a) (Interval 0.0) === (Interval 0.0)

  quickCheck \a ->
    (f >>> easeRepeat a) (Interval 1.0) === (Interval 1.0)

tests :: Tests
tests = suite "Animation" do
  suite "ease" do
    test "pow" do
      testEasing (easePow 1.0)
      testEasing (easePow 2.0)
      testEasing (easePow 3.0)
      testEasing (easePow 4.0)
      testEasing (easePow 5.0)

      testEasing (easePow 0.5)
      testEasing (easePow 1.5)
      testEasing (easePow 2.5)
      testEasing (easePow 3.5)
      testEasing (easePow 4.5)
      testEasing (easePow 5.5)

    test "exponential" do
      testEasing easeExponential

    test "sinusoidal" do
      testEasing easeSinusoidal

    test "circular" do
      testEasing easeCircular

    test "repeat" do
      testEasing (easeRepeat (-5))
      testEasing (easeRepeat (-4))
      testEasing (easeRepeat (-3))
      testEasing (easeRepeat (-2))
      testEasing (easeRepeat (-1))
      testEasing (easeRepeat 0)
      testEasing (easeRepeat 1)
      testEasing (easeRepeat 2)
      testEasing (easeRepeat 3)
      testEasing (easeRepeat 4)
      testEasing (easeRepeat 5)
