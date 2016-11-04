module Pauan.Test.View where

import Pauan.Prelude.Test
import Pauan.Resource (cleanup)
import Pauan.Mutable as Mutable
import Pauan.View (observe)

tests :: Tests
tests = suite "View" do
  test "observe" do
    push <- makePush

    liftEff do
      a <- Mutable.make 1
      resource <- a >> view >> observe (runPush push)
      resource >> cleanup
      runTransaction do
        a >> Mutable.set 2

    push >> equalPush [1]


  test "pure" do
    pure 1 >> equalView 1
    pure 2 >> equalView 2

    push <- makePush

    liftEff do
      resource <- 3 >> pure >> observe (runPush push)
      resource >> cleanup

    push >> equalPush [3]


  test "map" do
    push1 <- makePush
    push2 <- makePush

    a <- Mutable.make 1 >> liftEff

    let v = a >> view >> map \b -> b + 12 >> unsafeRunPush push2

    v >> equalView 13
    v >> equalView 13

    liftEff do
      resource <- v >> observe (runPush push1)
      runTransaction do
        a >> Mutable.set 2
        a >> Mutable.set 3
      resource >> cleanup
      runTransaction do
        a >> Mutable.set 4

    v >> equalView 16
    v >> equalView 16

    push1 >> equalPush [13, 15]
    push2 >> equalPush [13, 15, 16]


  test "apply (triangle)" do
    push1 <- makePush
    push2 <- makePush

    a <- Mutable.make 1 >> liftEff
    b <- Mutable.make 2 >> liftEff

    let v = a >> view >| b >> view >> map \c d -> c + d >> unsafeRunPush push2

    v >> equalView 3
    v >> equalView 3

    liftEff do
      resource <- v >> observe (runPush push1)
      runTransaction do
        a >> Mutable.set 3
        a >> Mutable.set 4
        b >> Mutable.set 5
        b >> Mutable.set 6
      resource >> cleanup
      runTransaction do
        a >> Mutable.set 7
        b >> Mutable.set 8

    v >> equalView 15
    v >> equalView 15

    push1 >> equalPush [3, 10]
    push2 >> equalPush [3, 10, 15]


  test "apply (diamond)" do
    push1 <- makePush
    push2 <- makePush
    push3 <- makePush
    push4 <- makePush

    a <- Mutable.make 1 >> liftEff

    let v1 = a >> view >> map \b -> b + 1 >> unsafeRunPush push2

    let v2 = a >> view >> map \c -> c - 5 >> unsafeRunPush push3

    let v3 = v1 >| v2 >> map \d e -> d + e >> unsafeRunPush push4

    v3 >> equalView (-2)
    v3 >> equalView (-2)

    liftEff do
      resource <- v3 >> observe (runPush push1)
      runTransaction do
        a >> Mutable.set 2
        a >> Mutable.set 3
      resource >> cleanup
      runTransaction do
        a >> Mutable.set 4

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

    a <- Mutable.make 1 >> liftEff
    b <- Mutable.make 2 >> liftEff

    let va = a >> view
    let vb = b >> view

    let v = do c <- va >> map (unsafeRunPush push2)
               vb >> map \d -> c + d >> unsafeRunPush push3

    v >> equalView 3
    v >> equalView 3

    liftEff do
      resource <- v >> observe (runPush push1)
      runTransaction do
        b >> Mutable.set 3
      runTransaction do
        a >> Mutable.set 4
      runTransaction do
        a >> Mutable.set 5
        b >> Mutable.set 6
      resource >> cleanup
      runTransaction do
        a >> Mutable.set 7
        b >> Mutable.set 8

    v >> equalView 15
    v >> equalView 15

    push1 >> equalPush [3, 4, 7, 11]
    push2 >> equalPush [1, 4, 5, 7]
    push3 >> equalPush [3, 4, 7, 11, 15]
