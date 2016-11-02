module Pauan.Test.Events where

import Pauan.Prelude.Test
import Pauan.Resource (cleanup)
import Pauan.Events as Events

tests :: Tests
tests = suite "Events" do
  test "receive, send, and cleanup" do
    push <- makePush

    liftEff do
      events <- Events.make
      resource <- events >> Events.receive (runPush push)
      events >> Events.send 1
      events >> Events.send 2
      events >> Events.send 3
      resource >> cleanup
      resource >> cleanup
      events >> Events.send 4

    push >> equalPush [1, 2, 3]


  test "if it receives while sending, it does not receive the current event" do
    push1 <- makePush
    push2 <- makePush
    push3 <- makePush

    liftEff do
      events <- Events.make
      resource1 <- events >> Events.receive \value -> do
        value >> runPush push1
        resource2 <- events >> Events.receive (runPush push2)
        resource2 >> cleanup
        events >> Events.receive (runPush push3) >> void
      events >> Events.send 1
      events >> Events.send 2
      events >> Events.send 3
      resource1 >> cleanup
      events >> Events.send 4

    push1 >> equalPush [1, 2, 3]
    push2 >> equalPush []
    push3 >> equalPush [2, 3, 3, 4, 4, 4]


  test "it should work correctly when cleaning up an old receiver while sending an event" do
    push1 <- makePush
    push2 <- makePush
    push3 <- makePush

    liftEff do
      events <- Events.make

      resource1 <- events >> Events.receive (runPush push1)

      resource2 <- events >> Events.receive \value -> do
        value >> runPush push2
        resource1 >> cleanup

      resource3 <- events >> Events.receive (runPush push3)

      events >> Events.send 1
      events >> Events.send 2
      resource2 >> cleanup
      resource3 >> cleanup
      events >> Events.send 3

    push1 >> equalPush [1]
    push2 >> equalPush [1, 2]
    push3 >> equalPush [1, 2]
