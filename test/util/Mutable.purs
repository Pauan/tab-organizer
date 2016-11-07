module Pauan.Test.Mutable where

import Pauan.Prelude.Test
import Pauan.Mutable as Mutable
import Pauan.Resource (cleanup)
import Pauan.View (observe)

tests :: Tests
tests = suite "Mutable" do
  test "get" do
    output <- toTest do
      a <- Mutable.make 1
      runTransaction do
        a >> Mutable.get
    output >> equal 1


  test "set" do
    output <- toTest do
      a <- Mutable.make 1
      runTransaction do
        a >> Mutable.set 2
        a >> Mutable.get
    output >> equal 2


  test "modify" do
    output <- toTest do
      a <- Mutable.make 1
      runTransaction do
        a >> Mutable.modify \b -> b + 12
        a >> Mutable.get
    output >> equal 13


  suite "view" do
    test "value" do
      a <- Mutable.make 1 >> toTest
      let v = a >> view
      v >> equalView 1
      toTest << runTransaction do
        a >> Mutable.set 2
      v >> equalView 2


    test "observe" do
      push <- makePush

      toTest do
        a <- Mutable.make 1
        resource <- a >> view >> observe (runPush push)
        resource >> cleanup
        runTransaction do
          a >> Mutable.set 2

      push >> equalPush [1]

      toTest do
        a <- Mutable.make 3
        resource <- a >> view >> observe (runPush push)
        runTransaction do
          a >> Mutable.set 4
          a >> Mutable.set 5
        resource >> cleanup
        runTransaction do
          a >> Mutable.set 6

      push >> equalPush [1, 3, 5]
