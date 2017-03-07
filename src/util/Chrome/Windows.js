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


function assert(bool) {
  if (!bool) {
    throw new Error("Assertion failed");
  }
}


function arrayRemove(array, value) {
  var index = array.indexOf(value);

  assert(index !== -1);

  array.splice(index, 1);

  return index;
}


function arrayRemoveIndex(array, index) {
  array.splice(index, 1);
}


function arrayInsertIndex(array, index, value) {
  array.splice(index, 0, value);
}


function updateIndexes(array, start, end, add) {
  while (start < end) {
    array[start].index += add;
    ++start;
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


// TODO remove this once Chrome bugs 357568 and 143281 are fixed
function callback(f) {
  return function () {
    try {
      return f.apply(this, arguments);

    } catch (e) {
      setTimeout(function () {
        throw e;
      }, 0);
    }
  };
}


function timeout(ms, done, error) {
  var timer = setTimeout(error, ms);

  return function () {
    clearTimeout(timer);
    return done.apply(this, arguments);
  };
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
    assert(focused.focused === true);
    focused.focused = false;
    state.focusedWindow = null;

    if (events) {
      state.WindowUnfocused(focused);
    }
  }
}


function focusWindow(state, window) {
  assert(window.focused === true);
  assert(state.focusedWindow !== window);

  state.focusedWindow = window;
}


function unfocusFocusedTab(state, window, events) {
  var focused = state.focusedTab[window.id];

  if (focused !== null) {
    assert(focused.active === true);
    focused.active = false;
    state.focusedTab[window.id] = null;

    if (events) {
      state.TabUnfocused(focused);
    }
  }
}


function unfocusTab(state, window, tab, events) {
  var focused = state.focusedTab[window.id];

  if (tab.active) {
    assert(focused === tab);
    unfocusFocusedTab(state, window, events);

  } else {
    assert(focused !== tab);
  }
}


function focusTab(state, window, tab) {
  assert(tab.active === true);
  assert(state.focusedTab[window.id] !== tab);

  state.focusedTab[window.id] = tab;
}


function removeWindow(state, window, events) {
  assert(!window.closed);

  // TODO is this correct ?
  assert(state.focusingWindows[window.id] == null);

  if (window.focused) {
    // TODO use unfocusWindow ?
    assert(state.focusedWindow === window);
    window.focused = false;
    state.focusedWindow = null;

  } else {
    assert(state.focusedWindow !== window);
  }

  window.tabs.forEach(function (tab) {
    assert(!tab.detached);
    removeTab(state, window, tab);
  });

  // TODO make this faster ?
  var index = arrayRemove(state.windows, window);

  delete state.focusedTab[window.id];
  delete state.windowIds[window.id];

  window.closed = true;

  if (events) {
    state.WindowClosed(window, index);
  }
}


function makeWindow(state, window, events) {
  if (window.type === "normal" ||
      window.type === "popup") {
    assert(state.focusedTab[window.id] == null);
    assert(state.windowIds[window.id] == null);

    // TODO is this order correct ?
    if (window.focused) {
      // TODO is this order correct ?
      unfocusWindow(state, events);
      focusWindow(state, window);
    }

    if (window.tabs == null) {
      window.tabs = [];
    }

    // TODO non-standard
    window.closed = false;

    var index = state.windows.length;
    state.focusedTab[window.id] = null;
    state.windowIds[window.id] = window;
    state.windows.push(window);

    window.tabs.forEach(function (tab, i) {
      assert(tab.index === i);
      makeTab(state, window, tab, false, false);
    });

    if (events) {
      state.WindowCreated(window, index);
    }
  }
}


function coerceTab(tab) {
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
}


function makeTab(state, window, tab, insert, events) {
  assert(state.tabIds[tab.id] == null);

  // TODO is this order correct ?
  // TODO is this needed ?
  if (tab.active) {
    // TODO is this order correct ?
    unfocusFocusedTab(state, window, events);
    focusTab(state, window, tab);
  }

  // TODO non-standard
  tab.window = window;
  tab.detached = false;

  coerceTab(tab);

  state.tabIds[tab.id] = tab;

  if (insert) {
    updateIndexes(window.tabs, tab.index, window.tabs.length, 1);
    arrayInsertIndex(window.tabs, tab.index, tab);
  }

  if (events) {
    state.TabCreated(tab, window, tab.index);
  }
}


// TODO openerTabId ?
// TODO mutedInfo ?
// TODO width ?
// TODO height ?
// TODO sessionId ?
// TODO highlighted ?
function updateTab(state, tab, info, events) {
  coerceTab(info);

  var changed = false;

  if (tab.pinned !== info.pinned) {
    tab.pinned = info.pinned;
    changed = true;
  }

  // TODO is this correct ?
  if (tab.audible !== info.audible) {
    tab.audible = info.audible;
    changed = true;
  }

  if (tab.discarded !== info.discarded) {
    tab.discarded = info.discarded;
    changed = true;
  }

  if (tab.autoDiscardable !== info.autoDiscardable) {
    tab.autoDiscardable = info.autoDiscardable;
    changed = true;
  }

  if (tab.url !== info.url) {
    tab.url = info.url;
    changed = true;
  }

  if (tab.title !== info.title) {
    tab.title = info.title;
    changed = true;
  }

  if (tab.favIconUrl !== info.favIconUrl) {
    tab.favIconUrl = info.favIconUrl;
    changed = true;
  }

  if (tab.status !== info.status) {
    tab.status = info.status;
    changed = true;
  }

  if (changed && events) {
    state.TabChanged(tab);
  }
}


function removeTab(state, window, tab) {
  assert(state.tabIds[tab.id] != null);

  delete state.tabIds[tab.id];
}


function initialize(success, failure, Broadcaster, broadcast, WindowCreated, WindowClosed, WindowFocused, WindowUnfocused, TabCreated, TabClosed, TabFocused, TabUnfocused, TabMovedInSameWindow, TabMovedToOtherWindow, TabChanged) {
  var events = Broadcaster();

  var state = {
    pending: [],

    closingWindows: {},
    focusingWindows: {},
    focusedWindow: null,
    windowIds: {},
    focusedTab: {},
    windows: [],

    tabIds: {},

    events: events,

    WindowCreated: function (window, index) {
      broadcast(WindowCreated(window)(index))(events)();
    },

    WindowClosed: function (window, index) {
      broadcast(WindowClosed(window)(index))(events)();
    },

    WindowFocused: function (window) {
      broadcast(WindowFocused(window))(events)();
    },

    WindowUnfocused: function (window) {
      broadcast(WindowUnfocused(window))(events)();
    },

    TabCreated: function (tab, window, index) {
      broadcast(TabCreated(tab)(window)(index))(events)();
    },

    TabClosed: function (tab, window, index) {
      broadcast(TabClosed(tab)(window)(index))(events)();
    },

    TabFocused: function (tab) {
      broadcast(TabFocused(tab))(events)();
    },

    TabUnfocused: function (tab) {
      broadcast(TabUnfocused(tab))(events)();
    },

    TabMovedInSameWindow: function (tab, window, from, to) {
      broadcast(TabMovedInSameWindow(tab)(window)(from)(to))(events)();
    },

    TabMovedToOtherWindow: function (tab, oldWindow, newWindow, oldIndex, newIndex) {
      broadcast(TabMovedToOtherWindow(tab)(oldWindow)(newWindow)(oldIndex)(newIndex))(events)();
    },

    TabChanged: function (tab) {
      broadcast(TabChanged(tab))(events)();
    },
  };

  // TODO is this needed ?
  onLoaded(function () {
    // TODO use a filter ?
    chrome.windows.onCreated.addListener(callback(function (window) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        makeWindow(state, window, events);
      });
    }));

    // TODO use a filter ?
    chrome.windows.onRemoved.addListener(callback(function (id) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var window = state.windowIds[id];

        if (window != null) {
          assert(!window.closed);
          assert(window.id === id);

          removeWindow(state, window, events);

          var pending = state.closingWindows[id];

          if (pending != null) {
            assert(events);

            delete state.closingWindows[id];
            pending();
          }

        } else {
          // TODO add more assertions
          assert(state.closingWindows[id] == null);
        }
      });
    }));

    // TODO use a filter ?
    chrome.windows.onFocusChanged.addListener(callback(function (id) {
      console.debug("chrome.windows.onFocusChanged", id);

      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        unfocusWindow(state, events);

        if (id !== chrome.windows.WINDOW_ID_NONE) {
          var window = state.windowIds[id];

          if (window != null) {
            assert(!window.closed);
            assert(window.id === id);

            assert(window.focused === false);
            window.focused = true;

            focusWindow(state, window);

            if (events) {
              state.WindowFocused(window);
            }

            var pending = state.focusingWindows[id];

            if (pending != null) {
              assert(events);

              delete state.focusingWindows[id];
              pending();
            }

          } else {
            // TODO add more assertions
            assert(state.focusingWindows[id] == null);
          }
        }
      });
    }));

    chrome.tabs.onCreated.addListener(callback(function (tab) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var window = state.windowIds[tab.windowId];

        if (window != null) {
          assert(window.id === tab.windowId);

          makeTab(state, window, tab, true, events);
        }
      });
    }));

    chrome.tabs.onUpdated.addListener(callback(function (id, changed, info) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[id];

        if (tab != null) {
          // TODO is this correct ?
          assert(!tab.detached);
          assert(tab.id === id);
          assert(info.id === id);
          assert(tab.windowId === info.windowId);
          assert(tab.window.id === tab.windowId);
          assert(tab.index === info.index);
          assert(tab.incognito === info.incognito);

          updateTab(state, tab, info, events);
        }
      });
    }));

    chrome.tabs.onActivated.addListener(callback(function (info) {
      console.debug("chrome.tabs.onActivated", info);

      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[info.tabId];

        if (tab != null) {
          assert(!tab.detached);
          assert(tab.id === info.tabId);
          assert(tab.windowId === info.windowId);
          assert(tab.window === state.windowIds[tab.windowId]);
          assert(tab.window.id === tab.windowId);

          unfocusFocusedTab(state, tab.window, events);

          // This is only true when detaching + attaching a focused tab
          if (tab.active) {
            focusTab(state, tab.window, tab);

          } else {
            tab.active = true;

            focusTab(state, tab.window, tab);

            if (events) {
              state.TabFocused(tab);
            }
          }
        }
      });
    }));

    chrome.tabs.onReplaced.addListener(callback(function (newId, oldId) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[oldId];

        if (tab != null) {
          // TODO is this correct ?
          assert(!tab.detached);
          assert(newId !== oldId);
          assert(tab.id === oldId);
          assert(state.tabIds[newId] == null);

          tab.id = newId;
          delete state.tabIds[oldId];
          state.tabIds[newId] = tab;
        }
      });
    }));

    chrome.tabs.onMoved.addListener(callback(function (id, info) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[id];

        if (tab != null) {
          assert(!tab.detached);
          assert(tab.id === id);
          assert(tab.windowId === info.windowId);
          assert(tab.index === info.fromIndex);
          assert(info.fromIndex !== info.toIndex);
          assert(tab.window === state.windowIds[tab.windowId]);
          assert(tab.window.id === tab.windowId);
          assert(tab.window.tabs[tab.index] === tab);

          arrayRemoveIndex(tab.window.tabs, tab.index);

          if (info.fromIndex < info.toIndex) {
            updateIndexes(tab.window.tabs, info.fromIndex, info.toIndex, -1);

          } else {
            updateIndexes(tab.window.tabs, info.toIndex, info.fromIndex, 1);
          }

          tab.index = info.toIndex;

          arrayInsertIndex(tab.window.tabs, tab.index, tab);

          if (events) {
            state.TabMovedInSameWindow(tab, tab.window, info.fromIndex, info.toIndex);
          }
        }
      });
    }));

    chrome.tabs.onRemoved.addListener(callback(function (id, info) {
      throwError();

      assert(typeof info.isWindowClosing === "boolean");

      if (!info.isWindowClosing) {
        // TODO is this correct ?
        // TODO test this
        onInit(state, function (events) {
          var tab = state.tabIds[id];

          if (tab != null) {
            // TODO is this correct ?
            assert(!tab.detached);
            assert(tab.id === id);
            assert(tab.windowId === info.windowId);
            assert(tab.window === state.windowIds[tab.windowId]);
            assert(tab.window.id === info.windowId);
            assert(tab.window.tabs[tab.index] === tab);

            arrayRemoveIndex(tab.window.tabs, tab.index);
            updateIndexes(tab.window.tabs, tab.index, tab.window.tabs.length, -1);

            // TODO should this send events ?
            unfocusTab(state, tab.window, tab, false);

            removeTab(state, tab.window, tab);

            if (events) {
              state.TabClosed(tab, tab.window, tab.index);
            }
          }
        });
      }
    }));

    chrome.tabs.onDetached.addListener(callback(function (id, info) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[id];

        if (tab != null) {
          assert(!tab.detached);
          assert(tab.id === id);
          assert(tab.windowId === info.oldWindowId);
          assert(tab.index === info.oldPosition);
          assert(tab.window === state.windowIds[tab.windowId]);
          assert(tab.window.id === tab.windowId);
          assert(tab.window.tabs[tab.index] === tab);

          // TODO code duplication with unfocusTab
          var focused = state.focusedTab[tab.window.id];

          if (tab.active) {
            assert(focused === tab);
            state.focusedTab[tab.window.id] = null;

          } else {
            assert(focused !== tab);
          }

          tab.detached = true;

          arrayRemoveIndex(tab.window.tabs, tab.index);
          updateIndexes(tab.window.tabs, tab.index, tab.window.tabs.length, -1);
        }
      });
    }));

    chrome.tabs.onAttached.addListener(callback(function (id, info) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[id];

        if (tab != null) {
          assert(tab.detached);
          assert(tab.id === id);
          assert(tab.windowId !== info.newWindowId);

          var oldWindow = tab.window;
          var newWindow = state.windowIds[info.newWindowId];

          assert(oldWindow === state.windowIds[tab.windowId]);
          assert(oldWindow.id === tab.windowId);

          assert(newWindow != null);
          assert(newWindow.id === info.newWindowId);

          var oldIndex = tab.index;

          tab.window = newWindow;
          tab.windowId = info.newWindowId;
          tab.index = info.newPosition;
          tab.detached = false;

          updateIndexes(newWindow.tabs, tab.index, newWindow.tabs.length, 1);
          arrayInsertIndex(newWindow.tabs, tab.index, tab);

          if (events) {
            state.TabMovedToOtherWindow(tab, oldWindow, newWindow, oldIndex, tab.index);
          }
        }
      });
    }));

    chrome.windows.getAll({
      populate: true
    }, callback(function (a) {
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
    }));
  });
}


exports.changeWindowImpl = function (unit, makeAff, state, left, top, width, height, drawAttention, window) {
  return makeAff(function (failure) {
    return function (success) {
      return function () {
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

        if (drawAttention != null) {
          info.drawAttention = drawAttention;
        }

        chrome.windows.update(window.id, info, callback(function (window) {
          var err = getError();

          if (err === null) {
            success(unit)();

          } else {
            failure(err)();
          }
        }));

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
              chrome.windows.remove(window.id, callback(function () {
                var err = getError();

                if (err === null) {
                  // TODO is this needed ?
                  // TODO test this
                  if (window.closed) {
                    success(unit)();

                  } else {
                    assert(state.closingWindows[window.id] == null);

                    // TODO this is super hacky, but necessary because Chrome
                    //      calls the callback before windows.onRemoved
                    // TODO test this
                    state.closingWindows[window.id] = timeout(10000, success(unit), function () {
                      delete state.closingWindows[window.id];
                      throw new Error("Waited for window " + window.id + " to close but it never did");
                    });
                  }

                } else {
                  failure(err)();
                }
              }));

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
                                failure(new Error("Minimized windows cannot be focused"))();
                                return unit;
                              }

                              // TODO it would be better if this was enforced statically
                              if (state === "maximized" && !focused) {
                                failure(new Error("Maximized windows cannot be unfocused"))();
                                return unit;
                              }

                              var info = {
                                url: tabs,
                                focused: focused,
                                incognito: incognito,
                                type: type,
                                state: state
                              };

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

                              chrome.windows.create(info, callback(function (info) {
                                var err = getError();

                                if (err === null) {
                                  var window = windows.windowIds[info.id];

                                  assert(window != null);
                                  assert(window.id === info.id);

                                  success(window)();

                                } else {
                                  failure(err)();
                                }
                              }));

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


exports.windowInfoImpl = function (unit) {
  return function (makeAff) {
    return function (Regular) {
      return function (Docked) {
        return function (Minimized) {
          return function (Maximized) {
            return function (Fullscreen) {
              return function (coords) {
                return function (info) {
                  return function (window) {
                    return makeAff(function (failure) {
                      return function (success) {
                        return function () {
                          chrome.windows.get(window.id, { populate: false }, callback(function (window) {
                            var err = getError();

                            if (err === null) {
                              var state;

                              if (window.state === "normal") {
                                state = Regular(window.left)(window.top)(window.width)(window.height);

                              } else if (window.state === "docked") {
                                state = Docked(window.left)(window.top)(window.width)(window.height);

                              } else if (window.state === "minimized") {
                                state = Minimized;

                              } else if (window.state === "maximized") {
                                state = Maximized;

                              } else if (window.state === "fullscreen") {
                                state = Fullscreen;

                              } else {
                                assert(false);
                              }

                              success(info(state)
                                          (coords(window.left)(window.top)(window.width)(window.height))
                                          (window.alwaysOnTop))();

                            } else {
                              failure(err)();
                            }
                          }));

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


exports.initializeImpl = function (unit) {
  return function (makeAff) {
    return function (Broadcaster) {
      return function (broadcast) {
        return function (WindowCreated) {
          return function (WindowClosed) {
            return function (WindowFocused) {
              return function (WindowUnfocused) {
                return function (TabCreated) {
                  return function (TabClosed) {
                    return function (TabFocused) {
                      return function (TabUnfocused) {
                        return function (TabMovedInSameWindow) {
                          return function (TabMovedToOtherWindow) {
                            return function (TabChanged) {
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
                                      TabClosed,
                                      TabFocused,
                                      TabUnfocused,
                                      TabMovedInSameWindow,
                                      TabMovedToOtherWindow,
                                      TabChanged
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
        assert(false);
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


exports.tabId = function (tab) {
  return function () {
    return tab.id;
  };
};

exports.tabIndexImpl = function (Just) {
  return function (Nothing) {
    return function (tab) {
      return function () {
        // TODO is this needed ?
        if (tab.detached) {
          return Nothing;

        } else {
          return Just(tab.index);
        }
      };
    };
  };
};

exports.tabIsFocused = function (tab) {
  return function () {
    return tab.active;
  };
};

exports.tabIsPinned = function (tab) {
  return function () {
    return tab.pinned;
  };
};

exports.tabIsAudible = function (tab) {
  return function () {
    // TODO is this correct ?
    return !!tab.audible;
  };
};

exports.tabIsDiscarded = function (tab) {
  return function () {
    return tab.discarded;
  };
};

exports.tabCanAutoDiscard = function (tab) {
  return function () {
    return tab.autoDiscardable;
  };
};

exports.tabUrlImpl = function (Just) {
  return function (Nothing) {
    return function (tab) {
      return function () {
        if (tab.url == null) {
          return Nothing;

        } else {
          return Just(tab.url);
        }
      };
    };
  };
};

exports.tabTitleImpl = function (Just) {
  return function (Nothing) {
    return function (tab) {
      return function () {
        if (tab.title == null) {
          return Nothing;

        } else {
          return Just(tab.title);
        }
      };
    };
  };
};

exports.tabFaviconUrlImpl = function (Just) {
  return function (Nothing) {
    return function (tab) {
      return function () {
        if (tab.favIconUrl == null) {
          return Nothing;

        } else {
          return Just(tab.favIconUrl);
        }
      };
    };
  };
};

exports.tabStatusImpl = function (Loading) {
  return function (Complete) {
    return function (tab) {
      return function () {
        if (tab.status === "loading") {
          return Loading;

        } else if (tab.status === "complete") {
          return Complete;

        } else {
          assert(false);
        }
      };
    };
  };
};

// TODO is this guaranteed to be pure ?
exports.tabIsIncognito = function (tab) {
  return tab.incognito;
};

exports.tabWindowImpl = function (Just) {
  return function (Nothing) {
    return function (tab) {
      return function () {
        if (tab.detached) {
          return Nothing;

        } else {
          return Just(tab.window);
        }
      };
    };
  };
};


exports.createNewTabImpl = function (unit) {
  return function (makeAff) {
    return function (state) {
      return function (window) {
        return function (index) {
          return function (url) {
            return function (focused) {
              return function (pinned) {
                return makeAff(function (failure) {
                  return function (success) {
                    return function () {
                      // TODO it would be better if this was enforced statically
                      if (window.type === "popup" && window.tabs.length > 0) {
                        failure(new Error("Cannot create a tab in a popup that already has a tab"))();
                        return unit;
                      }

                      var info = {
                        windowId: window.id,
                        url: url,
                        active: focused,
                        pinned: pinned
                      };

                      if (index != null) {
                        info.index = index;
                      }

                      chrome.tabs.create(info, callback(function (info) {
                        var err = getError();

                        if (err === null) {
                          var tab = state.tabIds[info.id];

                          assert(tab != null);
                          assert(tab.id === info.id);

                          success(tab)();

                        } else {
                          failure(err)();
                        }
                      }));

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


exports.changeTabImpl = function (unit) {
  return function (makeAff) {
    return function (url) {
      return function (pinned) {
        return function (tab) {
          return makeAff(function (failure) {
            return function (success) {
              return function () {
                var info = {};

                if (url != null) {
                  info.url = url;
                }

                if (pinned != null) {
                  info.pinned = pinned;
                }

                chrome.tabs.update(tab.id, info, callback(function (tab) {
                  var err = getError();

                  if (err === null) {
                    success(unit)();

                  } else {
                    failure(err)();
                  }
                }));

                return unit;
              };
            };
          });
        };
      };
    };
  };
};


exports.focusTabImpl = function (unit) {
  return function (makeAff) {
    return function (state) {
      return function (tab) {
        return makeAff(function (failure) {
          return function (success) {
            return function () {
              var errored = false;
              var pending = 2;

              function done() {
                --pending;

                if (pending === 0) {
                  success(unit)();
                }
              }

              // TODO throw the second error ?
              function error(e) {
                if (!errored) {
                  errored = true;
                  failure(err)();
                }
              }


              // TODO is detached correct ?
              if (tab.detached || tab.active) {
                done();

              } else {
                chrome.tabs.update(tab.id, { active: true }, callback(function () {
                  var err = getError();

                  if (err === null) {
                    assert(tab.active);
                    done();

                  } else {
                    error(err);
                  }
                }));
              }


              if (tab.detached || tab.window.focused) {
                done();

              } else {
                chrome.windows.update(tab.window.id, { focused: true }, callback(function () {
                  var err = getError();

                  if (err === null) {
                    // TODO this is super hacky, but necessary because Chrome
                    //      sometimes calls the callback before
                    //      windows.onFocusChanged, and sometimes after
                    if (tab.window.focused) {
                      done();

                    } else {
                      assert(state.focusingWindows[tab.window.id] == null);

                      // TODO test this
                      state.focusingWindows[tab.window.id] = timeout(10000, done, function () {
                        delete state.focusingWindows[tab.window.id];
                        throw new Error("Waited for window " + tab.window.id + " to be focused but it never was");
                      });
                    }

                  } else {
                    error(err);
                  }
                }));
              }

              return unit;
            };
          };
        });
      };
    };
  };
};
