module Pauan.Test.View where

import Pauan.Prelude.Test
import Pauan.Resource (cleanup)
import Pauan.Mutable as Mutable
import Pauan.View (observe)

tests :: Tests
tests = suite "View" do
  test "observe" do
    push <- makePush

    testUnit do
      a <- Mutable.make 1 >> runTransaction
      resource <- a >> view >> observe (runPush push)
      u <- resource >> cleanup
      runTransaction do
        a >> Mutable.set 2
      pure u

    push >> equalPush [1]


  -- TODO replace with quickcheck
  suite "Functor laws" do
    test "map id = id" do
      let v = pure 1
      a <- v >> map id >> currentValue >> runTransaction >> toTest
      b <- v >> id     >> currentValue >> runTransaction >> toTest
      b >> equal a

    test "map (f <<< g) = map f <<< map g" do
      let v = pure 1
      a <- v >> map (id <<< id)     >> currentValue >> runTransaction >> toTest
      b <- v >> (map id <<< map id) >> currentValue >> runTransaction >> toTest
      b >> equal a


  test "pure" do
    pure 1 >> equalView 1
    pure 2 >> equalView 2

    push <- makePush

    testUnit do
      resource <- 3 >> pure >> observe (runPush push)
      resource >> cleanup

    push >> equalPush [3]


  test "map" do
    push1 <- makePush
    push2 <- makePush

    a <- Mutable.make 1 >> runTransaction >> toTest

    let v = a >> view >> map \b -> b + 12 >> unsafeRunPush push2

    v >> equalView 13
    v >> equalView 13

    testUnit do
      resource <- v >> observe (runPush push1)
      runTransaction do
        a >> Mutable.set 2
        a >> Mutable.set 3
      u <- resource >> cleanup
      runTransaction do
        a >> Mutable.set 4
      pure u

    v >> equalView 16
    v >> equalView 16

    push1 >> equalPush [13, 15]
    push2 >> equalPush [13, 15, 16]


  suite "apply" do
    test "triangle" do
      push1 <- makePush
      push2 <- makePush

      a <- Mutable.make 1 >> runTransaction >> toTest
      b <- Mutable.make 2 >> runTransaction >> toTest

      let v = map2 (a >> view) (b >> view) \c d -> c + d >> unsafeRunPush push2

      v >> equalView 3
      v >> equalView 3

      testUnit do
        resource <- v >> observe (runPush push1)
        runTransaction do
          a >> Mutable.set 3
          a >> Mutable.set 4
          b >> Mutable.set 5
          b >> Mutable.set 6
        u <- resource >> cleanup
        runTransaction do
          a >> Mutable.set 7
          b >> Mutable.set 8
        pure u

      v >> equalView 15
      v >> equalView 15

      push1 >> equalPush [3, 10]
      push2 >> equalPush [3, 10, 15]


    test "diamond" do
      push1 <- makePush
      push2 <- makePush
      push3 <- makePush
      push4 <- makePush

      a <- Mutable.make 1 >> runTransaction >> toTest

      let v1 = a >> view >> map \b -> b + 1 >> unsafeRunPush push2

      let v2 = a >> view >> map \c -> c - 5 >> unsafeRunPush push3

      let v3 = map2 v1 v2 \d e -> d + e >> unsafeRunPush push4

      v3 >> equalView (-2)
      v3 >> equalView (-2)

      testUnit do
        resource <- v3 >> observe (runPush push1)
        runTransaction do
          a >> Mutable.set 2
          a >> Mutable.set 3
        u <- resource >> cleanup
        runTransaction do
          a >> Mutable.set 4
        pure u

      v3 >> equalView 4
      v3 >> equalView 4

      push1 >> equalPush [negate 2, 2]
      push2 >> equalPush [2, 4, 5]
      push3 >> equalPush [-4, -2, -1]
      push4 >> equalPush [-2, 2, 4]


  test "bind" do
    push1 <- makePush
    push2 <- makePush
    push3 <- makePush

    a <- Mutable.make 1 >> runTransaction >> toTest
    b <- Mutable.make 2 >> runTransaction >> toTest

    let va = a >> view
    let vb = b >> view

    let v = do c <- va >> map (unsafeRunPush push2)
               vb >> map \d -> c + d >> unsafeRunPush push3

    v >> equalView 3
    v >> equalView 3

    testUnit do
      resource <- v >> observe (runPush push1)
      runTransaction do
        b >> Mutable.set 3
      runTransaction do
        a >> Mutable.set 4
      runTransaction do
        a >> Mutable.set 5
        b >> Mutable.set 6
      u <- resource >> cleanup
      runTransaction do
        a >> Mutable.set 7
        b >> Mutable.set 8
      pure u

    v >> equalView 15
    v >> equalView 15

    push1 >> equalPush [3, 4, 7, 11]
    push2 >> equalPush [1, 4, 5, 7]
    push3 >> equalPush [3, 4, 7, 11, 15]
