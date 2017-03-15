module Server.Test where

import Pauan.Prelude.Test
import Pauan.Resource (cleanup)
import Pauan.Events as Events
import Pauan.Chrome as Chrome

testTabs :: forall e. Chrome.Window -> Array Chrome.Tab -> Aff e Unit
testTabs window expected = do
  tabs <- liftEff (Chrome.windowTabs window)
  equal expected tabs

testEvents state expected run = do
  push <- makePush
  resource <- liftEff (Events.receive (runPush push) (Chrome.events state))
  run
  liftEff (cleanup resource)
  equalPush expected push

runTests = runTest do
  suite "Chrome" do
    test "moveTabs" do
      state <- Chrome.initialize

      win1 <- Chrome.createNewWindow state
        { type: Chrome.Normal
        , state: Chrome.Minimized
        , focused: false
        , incognito: false
        , tabs: ["http://0.0.0.1/", "http://0.0.0.2/", "http://0.0.0.3/", "http://0.0.0.4/", "http://0.0.0.5/", "http://0.0.0.6/"] }

      win2 <- Chrome.createNewWindow state
        { type: Chrome.Normal
        , state: Chrome.Minimized
        , focused: false
        , incognito: false
        , tabs: ["http://0.0.0.7/"] }

      -- TODO hacky
      sleep 1000

      tabs1 <- liftEff (Chrome.windowTabs win1)
      tabs2 <- liftEff (Chrome.windowTabs win2)

      finally
        case tabs1, tabs2 of
          [tab1, tab2, tab3, tab4, tab5, tab6], [tab7] -> do
            testTabs win1 [tab1, tab2, tab3, tab4, tab5, tab6]
            testTabs win2 [tab7]


            testEvents state
              [ Chrome.TabMovedInSameWindow { tab: tab1, window: win1, oldIndex: 0, newIndex: 5 } ] do
              Chrome.moveTabs { window: win1, index: Nothing } [tab1]

            testTabs win1 [tab2, tab3, tab4, tab5, tab6, tab1]


            testEvents state
              [ Chrome.TabMovedInSameWindow { tab: tab1, window: win1, oldIndex: 5, newIndex: 0 } ] do
              Chrome.moveTabs { window: win1, index: Just 0 } [tab1]

            testTabs win1 [tab1, tab2, tab3, tab4, tab5, tab6]


            testEvents state
              [ Chrome.TabMovedInSameWindow { tab: tab2, window: win1, oldIndex: 1, newIndex: 0 }
              , Chrome.TabMovedInSameWindow { tab: tab3, window: win1, oldIndex: 2, newIndex: 1 }
              , Chrome.TabMovedInSameWindow { tab: tab4, window: win1, oldIndex: 3, newIndex: 2 } ] do
              Chrome.moveTabs { window: win1, index: Just 0 } [tab2, tab3, tab4]

            testTabs win1 [tab2, tab3, tab4, tab1, tab5, tab6]


            testEvents state
              [] do
              Chrome.moveTabs { window: win1, index: Just 2 } [tab4, tab1, tab5]

            testTabs win1 [tab2, tab3, tab4, tab1, tab5, tab6]


            testEvents state
              [] do
              Chrome.moveTabs { window: win1, index: Just 3 } [tab4, tab1, tab5]

            testTabs win1 [tab2, tab3, tab4, tab1, tab5, tab6]


            testEvents state
              [] do
              Chrome.moveTabs { window: win1, index: Just 4 } [tab4, tab1, tab5]

            testTabs win1 [tab2, tab3, tab4, tab1, tab5, tab6]


            testEvents state
              [] do
              Chrome.moveTabs { window: win1, index: Just 5 } [tab4, tab1, tab5]

            testTabs win1 [tab2, tab3, tab4, tab1, tab5, tab6]


            testEvents state
              [ Chrome.TabMovedInSameWindow { tab: tab4, window: win1, oldIndex: 2, newIndex: 5 }
              , Chrome.TabMovedInSameWindow { tab: tab1, window: win1, oldIndex: 2, newIndex: 5 }
              , Chrome.TabMovedInSameWindow { tab: tab5, window: win1, oldIndex: 2, newIndex: 5 } ] do
              Chrome.moveTabs { window: win1, index: Just 6 } [tab4, tab1, tab5]

            testTabs win1 [tab2, tab3, tab6, tab4, tab1, tab5]


            testEvents state
              [ Chrome.TabMovedInSameWindow { tab: tab5, window: win1, oldIndex: 5, newIndex: 3 } ] do
              Chrome.moveTabs { window: win1, index: Just 1 } [tab3, tab6, tab5]

            testTabs win1 [tab2, tab3, tab6, tab5, tab4, tab1]


            testEvents state
              [ Chrome.TabMovedInSameWindow { tab: tab4, window: win1, oldIndex: 4, newIndex: 2 }
              , Chrome.TabMovedInSameWindow { tab: tab1, window: win1, oldIndex: 5, newIndex: 3 } ] do
              Chrome.moveTabs { window: win1, index: Just 1 } [tab3, tab4, tab1]

            testTabs win1 [tab2, tab3, tab4, tab1, tab6, tab5]


            testEvents state
              [] do
              Chrome.moveTabs { window: win1, index: Nothing } [tab2, tab3, tab4, tab1, tab6, tab5]

            testTabs win1 [tab2, tab3, tab4, tab1, tab6, tab5]


            testEvents state
              [] do
              Chrome.moveTabs { window: win1, index: Nothing } [tab1, tab6, tab5]

            testTabs win1 [tab2, tab3, tab4, tab1, tab6, tab5]


            testEvents state
              [] do
              Chrome.moveTabs { window: win1, index: Nothing } [tab5]

            testTabs win1 [tab2, tab3, tab4, tab1, tab6, tab5]


            testEvents state
              [ Chrome.TabMovedInSameWindow { tab: tab5, window: win1, oldIndex: 5, newIndex: 0 }
              , Chrome.TabMovedInSameWindow { tab: tab6, window: win1, oldIndex: 5, newIndex: 1 }
              , Chrome.TabMovedInSameWindow { tab: tab1, window: win1, oldIndex: 5, newIndex: 2 }
              , Chrome.TabMovedInSameWindow { tab: tab4, window: win1, oldIndex: 5, newIndex: 3 }
              , Chrome.TabMovedInSameWindow { tab: tab3, window: win1, oldIndex: 5, newIndex: 4 } ] do
              Chrome.moveTabs { window: win1, index: Just 0 } [tab5, tab6, tab1, tab4, tab3, tab2]

            testTabs win1 [tab5, tab6, tab1, tab4, tab3, tab2]


            testEvents state
              [ Chrome.TabMovedToOtherWindow { tab: tab6, oldWindow: win1, newWindow: win2, oldIndex: 1, newIndex: 0 }
              , Chrome.TabMovedToOtherWindow { tab: tab4, oldWindow: win1, newWindow: win2, oldIndex: 2, newIndex: 1 }
              , Chrome.TabMovedToOtherWindow { tab: tab3, oldWindow: win1, newWindow: win2, oldIndex: 2, newIndex: 2 } ] do
              Chrome.moveTabs { window: win2, index: Just 0 } [tab6, tab4, tab3]

            testTabs win1 [tab5, tab1, tab2]
            testTabs win2 [tab6, tab4, tab3, tab7]


            testEvents state
              [ Chrome.TabMovedToOtherWindow { tab: tab3, oldWindow: win2, newWindow: win1, oldIndex: 2, newIndex: 3 }
              , Chrome.TabMovedInSameWindow { tab: tab1, window: win1, oldIndex: 1, newIndex: 3 }
              , Chrome.TabMovedToOtherWindow { tab: tab6, oldWindow: win2, newWindow: win1, oldIndex: 0, newIndex: 4 } ] do
              Chrome.moveTabs { window: win1, index: Nothing } [tab2, tab3, tab1, tab6]

            testTabs win1 [tab5, tab2, tab3, tab1, tab6]
            testTabs win2 [tab4, tab7]

          _, _ ->
            failure "Pattern match failed"

        do
          Chrome.closeWindow state win1
          Chrome.closeWindow state win2
