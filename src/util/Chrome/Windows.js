"use strict";

/**
 * @ Tab lifecycle
 *
 *  @ When opening a window
 *    windows.onCreated
 *    window.create
 *
 *   @ When removing a window
 *     windows.remove
 *     windows.onRemoved
 *
 *   @ When creating
 *     @ If it's a new window
 *       windows.onFocusChanged (old)
 *       windows.onCreated
 *     tabs.onCreated
 *     tabs.onActivated
 *     tabs.create
 *     @ If it's not loaded from cache
 *       tabs.onUpdated
 *
 *   @ When updating
 *     tabs.update
 *     tabs.onUpdated
 *
 *   @ When focusing a different tab
 *     tabs.onActivated
 *     tabs.update
 *
 *   @ When moving in the same window
 *     tabs.onMoved
 *     tabs.move
 *
 *   @ When moving to another window
 *     @ If the old window still has tabs in it
 *       windows.onCreated
 *       tabs.onDetached
 *       tabs.onActivated (old window)
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *     @ If the old window does not still have tabs in it
 *       tabs.onDetached
 *       tabs.onAttached
 *       tabs.onActivated (new window)
 *       windows.onRemoved
 *
 *   @ When removing
 *     tabs.onRemoved
 *     @ If the old window still has tabs in it
 *       tabs.onActivated
 *       tabs.remove
 *     @ If the old window does not still have tabs in it
 *       tabs.remove
 *       windows.onRemoved
 *
 *
 * windows.onCreated
 */


function arrayRemove(array, value) {
  var index = array.indexOf(value);

  console.assert(index !== -1);

  array.splice(index, 1);
}


function arrayRemoveIndex(array, index) {
  array.splice(index, 1);
}


function arrayInsertIndex(array, index, value) {
  array.splice(index, 0, value);
}


function updateIndexes(array, index, add) {
  var length = array.length;

  while (index < length) {
    array[index] += add;
    ++index;
  }
}


function getError() {
  if (chrome.runtime.lastError != null) {
    return new Error(chrome.runtime.lastError.message);

  } else {
    return null;
  }
}


function throwError() {
  var error = getError();

  if (error !== null) {
    throw error;
  }
}


// TODO is this needed ?
function onLoaded(f) {
  if (document.readyState === "complete") {
    f();

  } else {
    addEventListener("load", function () {
      f();
    }, true);
  }
}


function onInit(state, f) {
  if (state.pending === null) {
    f(true);

  } else {
    state.pending.push(f);
  }
}


function unfocusWindow(state, events) {
  var focused = state.focusedWindow;

  if (focused !== null) {
    console.assert(focused.focused === true);
    focused.focused = false;
    state.focusedWindow = null;

    if (events) {
      state.WindowUnfocused(focused);
    }
  }
}


function focusWindow(state, window) {
  console.assert(window.focused === true);
  console.assert(state.focusedWindow !== window);

  state.focusedWindow = window;
}


function unfocusTab(state, window, events) {
  var focused = state.focusedTabs[window.id];

  if (focused !== null) {
    console.assert(focused.active === true);
    focused.active = false;
    state.focusedTabs[window.id] = null;

    if (events) {
      state.TabUnfocused(window, focused);
    }
  }
}


function focusTab(state, window, tab) {
  console.assert(tab.active === true);
  console.assert(state.focusedTabs[window.id] !== tab);

  state.focusedTabs[window.id] = tab;
}


function removeWindow(state, window, events) {
  if (window.focused) {
    // TODO use unfocusWindow ?
    console.assert(state.focusedWindow === window);
    window.focused = false;
    state.focusedWindow = null;

  } else {
    console.assert(state.focusedWindow !== window);
  }

  // TODO make this faster ?
  arrayRemove(state.windows, window);

  delete state.focusedTabs[window.id];
  delete state.windowIds[window.id];

  if (events) {
    state.WindowClosed(window);
  }
}


function makeWindow(state, window, events) {
  if (window.type === "normal" ||
      window.type === "popup") {
    console.assert(state.focusedTabs[window.id] == null);
    console.assert(state.windowIds[window.id] == null);

    if (window.focused) {
      // TODO is this order correct ?
      unfocusWindow(state, events);
      focusWindow(state, window);
    }

    if (window.tabs == null) {
      window.tabs = [];
    }

    state.focusedTabs[window.id] = null;
    state.windowIds[window.id] = window;
    state.windows.push(window);

    window.tabs.forEach(function (tab, i) {
      console.assert(tab.index === i);
      makeTab(state, window, tab, false, false);
    });

    if (events) {
      state.WindowCreated(window);
    }
  }
}


function makeTab(state, window, tab, insert, events) {
  console.assert(state.tabIds[tab.id] == null);

  if (tab.active) {
    // TODO is this order correct ?
    unfocusTab(state, window, events);
    focusTab(state, window, tab);
  }

  // TODO is this necessary ?
  if (!tab.url) {
    tab.url = null;
  }

  // TODO is this necessary ?
  if (!tab.title) {
    tab.title = null;
  }

  if (!tab.favIconUrl) {
    tab.favIconUrl = null;
  }

  state.tabIds[tab.id] = tab;

  if (insert) {
    updateIndexes(window.tabs, tab.index, 1);
    arrayInsertIndex(window.tabs, tab.index, tab);
  }

  if (events) {
    state.TabCreated(window, tab);
  }
}


function initialize(success, failure, Broadcaster, broadcast, WindowCreated, WindowClosed, WindowFocused, WindowUnfocused, TabCreated, TabFocused, TabUnfocused, TabClosed) {
  var events = Broadcaster();

  var state = {
    pending: [],

    closingWindows: {},
    focusedWindow: null,
    windowIds: {},
    focusedTabs: {},
    windows: [],

    tabIds: {},

    events: events,

    WindowCreated: function (a) {
      broadcast(WindowCreated(a))(events)();
    },

    WindowClosed: function (a) {
      broadcast(WindowClosed(a))(events)();
    },

    WindowFocused: function (a) {
      broadcast(WindowFocused(a))(events)();
    },

    WindowUnfocused: function (a) {
      broadcast(WindowUnfocused(a))(events)();
    },

    TabCreated: function (window, tab) {
      broadcast(TabCreated(window)(tab))(events)();
    },

    TabFocused: function (window, tab) {
      broadcast(TabFocused(window)(tab))(events)();
    },

    TabUnfocused: function (window, tab) {
      broadcast(TabUnfocused(window)(tab))(events)();
    },

    TabClosed: function (window, tab) {
      broadcast(TabClosed(window)(tab))(events)();
    }
  };

  // TODO is this needed ?
  onLoaded(function () {
    // TODO use a filter ?
    chrome.windows.onCreated.addListener(function (window) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        makeWindow(state, window, events);
      });
    });

    // TODO use a filter ?
    chrome.windows.onRemoved.addListener(function (id) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var window = state.windowIds[id];

        if (window != null) {
          console.assert(window.id === id);

          removeWindow(state, window, events);

          var closing = state.closingWindows[id];

          if (closing != null) {
            console.assert(events);

            delete state.closingWindows[id];
            closing();
          }
        }
      });
    });

    // TODO use a filter ?
    chrome.windows.onFocusChanged.addListener(function (id) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        unfocusWindow(state, events);

        if (id !== chrome.windows.WINDOW_ID_NONE) {
          var window = state.windowIds[id];

          if (window != null) {
            console.assert(window.id === id);

            console.assert(window.focused === false);
            window.focused = true;

            focusWindow(state, window);

            if (events) {
              state.WindowFocused(window);
            }
          }
        }
      });
    });

    chrome.tabs.onCreated.addListener(function (tab) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var window = state.windowIds[tab.windowId];

        if (window != null) {
          console.assert(window.id === tab.windowId);

          makeTab(state, window, tab, true, events);
        }
      });
    });

    chrome.tabs.onActivated.addListener(function (info) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[info.tabId];

        if (tab != null) {
          console.assert(tab.id === info.tabId);
          console.assert(tab.windowId === info.windowId);

          var window = state.windowIds[tab.windowId];

          console.assert(window != null);
          console.assert(window.id === tab.windowId);

          unfocusTab(state, window, events);

          console.assert(tab.active === false);
          tab.active = true;

          focusTab(state, window, tab);

          if (events) {
            state.TabFocused(window, tab);
          }
        }
      });
    });

    chrome.tabs.onReplaced.addListener(function (newId, oldId) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[oldId];

        if (tab != null) {
          console.assert(newId !== oldId);
          console.assert(tab.id === oldId);
          console.assert(state.tabIds[newId] == null);

          tab.id = newId;
          delete state.tabIds[oldId];
          state.tabIds[newId] = tab;
        }
      });
    });

    chrome.tabs.onRemoved.addListener(function (id, info) {
      throwError();

      console.assert(typeof info.isWindowClosing === "boolean");

      if (!info.isWindowClosing) {
        // TODO is this correct ?
        // TODO test this
        onInit(state, function (events) {
          var tab = state.tabIds[id];

          if (tab != null) {
            console.assert(tab.id === id);
            console.assert(tab.windowId === info.windowId);

            var window = state.windowIds[tab.windowId];

            console.assert(window != null);
            console.assert(window.id === info.windowId);

            console.assert(window.tabs[tab.index] === tab);

            if (tab.active) {
              // TODO use unfocusTab ?
              console.assert(state.focusedTabs[window.id] === tab);
              tab.active = false;
              state.focusedTabs[window.id] = null;

            } else {
              console.assert(state.focusedTabs[window.id] !== tab);
            }

            arrayRemoveIndex(window.tabs, tab.index);
            updateIndexes(window.tabs, tab.index, -1);

            delete state.tabIds[id];

            if (events) {
              state.TabClosed(window, tab);
            }
          }
        });
      }
    });

    chrome.windows.getAll({
      populate: true
    }, function (a) {
      var err = getError();

      if (err === null) {
        a.forEach(function (window) {
          makeWindow(state, window, false);
        });

        // TODO is this correct ?
        // TODO test this
        state.pending.forEach(function (f) {
          f(false);
        });

        state.pending = null;

        success(state)();

      } else {
        failure(err)();
      }
    });
  });
}


exports.changeWindowImpl = function (unit, makeAff, state, left, top, width, height, focused, drawAttention, window) {
  return makeAff(function (failure) {
    return function (success) {
      return function () {
        // TODO it would be better if this was enforced statically
        if (state === "minimized" && focused) {
          throw new Error("Minimized windows cannot be focused");
        }

        // TODO it would be better if this was enforced statically
        if (state === "maximized" && !focused) {
          throw new Error("Maximized windows cannot be unfocused");
        }

        var info = {};

        if (state != null) {
          info.state = state;
        }

        if (left != null) {
          info.left = left;
        }

        if (top != null) {
          info.top = top;
        }

        if (width != null) {
          info.width = width;
        }

        if (height != null) {
          info.height = height;
        }

        if (focused != null) {
          info.focused = focused;
        }

        if (drawAttention != null) {
          info.drawAttention = drawAttention;
        }

        chrome.windows.update(window.id, info, function (window) {
          var err = getError();

          if (err === null) {
            success(unit)();

          } else {
            failure(err)();
          }
        });

        return unit;
      };
    };
  });
};


exports.closeWindowImpl = function (unit) {
  return function (makeAff) {
    return function (state) {
      return function (window) {
        return makeAff(function (failure) {
          return function (success) {
            return function () {
              chrome.windows.remove(window.id, function () {
                var err = getError();

                if (err === null) {
                  console.assert(state.closingWindows[window.id] == null);
                  state.closingWindows[window.id] = success(unit);

                } else {
                  failure(err)();
                }
              });

              return unit;
            };
          };
        });
      };
    };
  };
};


exports.eventsImpl = function (events) {
  return function (state) {
    return events(state.events);
  };
};


exports.createNewWindowImpl = function (unit) {
  return function (makeAff) {
    return function (type) {
      return function (state) {
        return function (left) {
          return function (top) {
            return function (width) {
              return function (height) {
                return function (focused) {
                  return function (incognito) {
                    return function (tabs) {
                      return function (windows) {
                        return makeAff(function (failure) {
                          return function (success) {
                            return function () {
                              // TODO it would be better if this was enforced statically
                              if (state === "minimized" && focused) {
                                throw new Error("Minimized windows cannot be focused");
                              }

                              // TODO it would be better if this was enforced statically
                              if (state === "maximized" && !focused) {
                                throw new Error("Maximized windows cannot be unfocused");
                              }

                              var info = {
                                focused: focused,
                                incognito: incognito,
                                type: type,
                                state: state
                              };

                              // TODO is this a good idea ?
                              if (tabs.length !== 0) {
                                info.url = tabs;
                              }

                              if (left != null) {
                                info.left = left;
                              }

                              if (top != null) {
                                info.top = top;
                              }

                              if (width != null) {
                                info.width = width;
                              }

                              if (height != null) {
                                info.height = height;
                              }

                              chrome.windows.create(info, function (info) {
                                var err = getError();

                                if (err === null) {
                                  var window = windows.windowIds[info.id];

                                  console.assert(window != null);
                                  console.assert(window.id === info.id);

                                  success(window)();

                                } else {
                                  failure(err)();
                                }
                              });

                              return unit;
                            };
                          };
                        });
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
};


function getWindow(window, done) {
  chrome.windows.get(window.id, { populate: false }, function (window) {
    var err = getError();

    if (err === null) {
      done(null, window);

    } else {
      done(err, null);
    }
  });
}


exports.windowCoordinatesImpl = function (unit) {
  return function (makeAff) {
    return function (coords) {
      return function (window) {
        return makeAff(function (failure) {
          return function (success) {
            return function () {
              getWindow(window, function (err, window) {
                if (err === null) {
                  success(coords(window.left)(window.top)(window.width)(window.height))();

                } else {
                  failure(err)();
                }
              });
              return unit;
            };
          };
        });
      };
    };
  };
};


exports.windowStateImpl = function (unit) {
  return function (makeAff) {
    return function (regular) {
      return function (docked) {
        return function (minimized) {
          return function (maximized) {
            return function (fullscreen) {
              return function (window) {
                return makeAff(function (failure) {
                  return function (success) {
                    return function () {
                      getWindow(window, function (err, window) {
                        if (err === null) {
                          if (window.state === "normal") {
                            success(regular(window.left)(window.top)(window.width)(window.height))();

                          } else if (window.state === "docked") {
                            success(docked(window.left)(window.top)(window.width)(window.height))();

                          } else if (window.state === "minimized") {
                            success(minimized)();

                          } else if (window.state === "maximized") {
                            success(maximized)();

                          } else if (window.state === "fullscreen") {
                            success(fullscreen)();

                          } else {
                            console.assert(false);
                          }

                        } else {
                          failure(err)();
                        }
                      });
                      return unit;
                    };
                  };
                });
              };
            };
          };
        };
      };
    };
  };
};


exports.initializeImpl = function (unit) {
  return function (makeAff) {
    return function (Broadcaster) {
      return function (broadcast) {
        return function (WindowCreated) {
          return function (WindowClosed) {
            return function (WindowFocused) {
              return function (WindowUnfocused) {
                return function (TabCreated) {
                  return function (TabFocused) {
                    return function (TabUnfocused) {
                      return function (TabClosed) {
                        return makeAff(function (failure) {
                          return function (success) {
                            return function () {
                              initialize(
                                success,
                                failure,
                                Broadcaster,
                                broadcast,
                                WindowCreated,
                                WindowClosed,
                                WindowFocused,
                                WindowUnfocused,
                                TabCreated,
                                TabFocused,
                                TabUnfocused,
                                TabClosed
                              );
                              return unit;
                            };
                          };
                        });
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
};


exports.windowId = function (window) {
  return window.id;
};


exports.windowTypeImpl = function (normal) {
  return function (popup) {
    return function (window) {
      if (window.type === "normal") {
        return normal;

      } else if (window.type === "popup") {
        return popup;

      } else {
        console.assert(false);
      }
    };
  };
};


exports.windows = function (state) {
  return function () {
    // TOOD make this faster ?
    return state.windows.slice();
  };
};


exports.windowTabs = function (window) {
  return function () {
    // TOOD make this faster ?
    return window.tabs.slice();
  };
};


exports.windowIsIncognito = function (window) {
  return window.incognito;
};


exports.windowIsFocused = function (window) {
  return function () {
    return window.focused;
  };
};
