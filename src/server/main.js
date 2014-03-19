// TODO the "calibrate screen size" popup seems to break an assertion in deserialize.tab
// TODO in a window with a pinned tab, try to move (in TO) multiple non-pinned tabs above the pinned tab
// TODO in TO, move a tab into a different window, then move it back to the old window, assertion failed
// TODO create a window with a single tab, (in TO) move the tab into another window, there is now an empty group
// TODO when starting to rename a group, it should select all the text in the textbox, like in TO 4
// TODO disable dragging a tab's favicon
// TODO assertion failed with the search syntax `-is:selected`
// TODO when serializing syntax errors in the search box, should wrap in parens according to the precedence. e.g. `foo:(bar|qux)` should serialize as `foo:(bar|qux)` but currently serializes as `foo:bar|qux`
// TODO test that `foo:bar|qux` parses correctly, should be `(foo:bar) | qux`
// TODO while typing in the search box, the text cursor gets messed up, probably has to do with the dual cell bind sync
// TODO after focusing a tab in TO, it should then focus the popup
// TODO animation for menu show/hide is screwed up
// TODO check to see that updating a tab's info works correctly with "logic"
// TODO proper coloring for selected tabs
// TODO double check opt.js "option-loader" module
// TODO stress test "tabs.close.duplicates"
// TODO test ui.radio to see if it's working correctly; also test the radio buttons in the option page
// TODO set bubble height to 1000px; now there's 2 vertical scrollbars
// TODO opening the bubble while the popup is already open does not close the popup
// TODO different hotkeys for each popup mode ???
// TODO make the little arrows stand out more
// TODO sort tabs in Chrome based on URL, domain, etc.
// TODO when using "URL" tab sorting, tabs should be sorted by the simplified URL (lowercase)
// TODO when clicking on a non-selected tab, it should unselect all tabs in all groups, rather than only the current group ?
// TODO open up the group's menu then go to "All tabs in group..." then go to "Group...", the menu should be above in z-index but it's below ?
// TODO when hovering over a group's name, it should show the group's name in a little popup, just like it does with tabs
// TODO when the URL bar isn't big enough, it truncates both the search query and the path; it should only truncate whichever is the right-most in the URL bar
// TODO test the animation for the "Group..." submenu for tabs
// TODO open up the Menu, open the submenu "Sort tabs by...", switch to another item so the submenu closes, then before it has closed, move the mouse over the submenu. The cursor should be "default" but it is "pointer"
// TODO when a submenu is out of bounds, first try placing it on the opposite side of the parent menu
// TODO some of the colors are really ugly, probably need to hand-code them in "common-ui"

goog.provide("main")

goog.require("tabs")
goog.require("popup")
goog.require("importExport")
goog.require("counter")
