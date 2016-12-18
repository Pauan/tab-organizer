module Pauan.Test.Events where

import Pauan.Prelude.Test
import Pauan.Resource (cleanup)
import Pauan.Events as Events

testEvents :: forall a. (Eq a, Show a) => Array a -> Events.Events a -> Events.Broadcaster Int -> TestAff Unit
testEvents expected actual events = do
  push <- makePush

  testUnit do
    resource <- actual >> Events.receive (runPush push)
    events >> Events.broadcast 1
    events >> Events.broadcast 2
    events >> Events.broadcast 3
    u <- resource >> cleanup
    resource >> cleanup
    events >> Events.broadcast 4
    pure u

  push >> equalPush expected


tests :: Tests
tests = suite "Events" do
  test "receive, broadcast, and cleanup" do
    events <- Events.makeBroadcaster >> liftEff
    events >> testEvents [1, 2, 3] (events >> Events.events)


  test "if it receives while broadcasting, it does not receive the current event" do
    push1 <- makePush
    push2 <- makePush
    push3 <- makePush

    testUnit do
      events <- Events.makeBroadcaster
      resource1 <- events >> Events.events >> Events.receive \value -> do
        value >> runPush push1
        resource2 <- events >> Events.events >> Events.receive (runPush push2)
        resource2 >> cleanup
        events >> Events.events >> Events.receive (runPush push3) >> void
      events >> Events.broadcast 1
      events >> Events.broadcast 2
      events >> Events.broadcast 3
      u <- resource1 >> cleanup
      events >> Events.broadcast 4
      pure u

    push1 >> equalPush [1, 2, 3]
    push2 >> equalPush []
    push3 >> equalPush [2, 3, 3, 4, 4, 4]


  test "it should work correctly when cleaning up an old receiver while broadcasting an event" do
    push1 <- makePush
    push2 <- makePush
    push3 <- makePush

    testUnit do
      events <- Events.makeBroadcaster

      resource1 <- events >> Events.events >> Events.receive (runPush push1)

      resource2 <- events >> Events.events >> Events.receive \value -> do
        value >> runPush push2
        resource1 >> cleanup

      resource3 <- events >> Events.events >> Events.receive (runPush push3)

      events >> Events.broadcast 1
      events >> Events.broadcast 2
      u <- resource2 >> cleanup
      resource3 >> cleanup
      events >> Events.broadcast 3
      pure u

    push1 >> equalPush [1]
    push2 >> equalPush [1, 2]
    push3 >> equalPush [1, 2]


  test "map" do
    events <- Events.makeBroadcaster >> liftEff
    events >> testEvents [21, 22, 23] (events >> Events.events >> map \a -> a + 20)


  test "filter" do
    events <- Events.makeBroadcaster >> liftEff
    events >> testEvents [1] (events >> Events.events >> filter \a -> a < 2)
    events >> testEvents [2, 3] (events >> Events.events >> filter \a -> a > 1)


  test "filterMap" do
    events <- Events.makeBroadcaster >> liftEff
    events >> testEvents [21] (events >> Events.events >> filterMap \a -> if a < 2 then Just (a + 20) else Nothing)
    events >> testEvents [12, 13] (events >> Events.events >> filterMap \a -> if a > 1 then Just (a + 10) else Nothing)


  test "partition" do
    events <- Events.makeBroadcaster >> liftEff
    let p = events >> Events.events >> partition \a -> a < 2
    events >> testEvents [1] p.no
    events >> testEvents [2, 3] p.yes


  test "partitionMap" do
    events <- Events.makeBroadcaster >> liftEff
    let p = events >> Events.events >> partitionMap \a -> if a < 2 then Left (a + 20) else Right (a - 20)
    events >> testEvents [21] p.left
    events >> testEvents [-18, -17] p.right
