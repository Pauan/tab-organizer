require("../../hubs")

@ = require([
  { id: "lib:extension/client" },

  { id: "./categories/Counter", name: "counter" },
  { id: "./categories/Groups", name: "groups" },
  { id: "./categories/Popup", name: "popup" },
  { id: "./categories/Tabs", name: "tabs" },
  { id: "./categories/Theme", name: "theme" },
  { id: "./categories/User Data", name: "user_data" }
])


@options.top(document.body, [
  @theme.top(),
  @groups.top(),
  @tabs.top(),
  @popup.top(),
  @counter.top(),
  @user_data.top()
])


console.info("main: finished")