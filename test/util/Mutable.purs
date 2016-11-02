module Pauan.Test.Mutable where

import Pauan.Prelude.Test
import Pauan.Mutable as Mutable

tests :: Tests
tests = suite "Mutable" do
  test "get" do
    output <- liftEff do
      a <- Mutable.make 1
      runTransaction do
        a >> Mutable.get
    output >> equal 1

  test "set" do
    output <- liftEff do
      a <- Mutable.make 1
      runTransaction do
        a >> Mutable.set 2
        a >> Mutable.get
    output >> equal 2

  test "modify" do
    output <- liftEff do
      a <- Mutable.make 1
      runTransaction do
        a >> Mutable.modify \b -> b + 12
        a >> Mutable.get
    output >> equal 13
