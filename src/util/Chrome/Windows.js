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
  var focused = state.focusedTabs[window.id];

  if (focused !== null) {
    assert(focused.active === true);
    focused.active = false;
    state.focusedTabs[window.id] = null;

    if (events) {
      state.TabUnfocused(focused);
    }
  }
}


function unfocusTab(state, window, tab, events) {
  var focused = state.focusedTabs[window.id];

  if (tab.active) {
    assert(focused === tab);
    unfocusFocusedTab(state, window, events);

  } else {
    assert(focused !== tab);
  }
}


function focusTab(state, window, tab) {
  assert(tab.active === true);
  assert(state.focusedTabs[window.id] !== tab);

  state.focusedTabs[window.id] = tab;
}


function removeWindow(state, window, events) {
  if (window.focused) {
    // TODO use unfocusWindow ?
    assert(state.focusedWindow === window);
    window.focused = false;
    state.focusedWindow = null;

  } else {
    assert(state.focusedWindow !== window);
  }

  // TODO make this faster ?
  var index = arrayRemove(state.windows, window);

  delete state.focusedTabs[window.id];
  delete state.windowIds[window.id];

  if (events) {
    state.WindowClosed(window, index);
  }
}


function makeWindow(state, window, events) {
  if (window.type === "normal" ||
      window.type === "popup") {
    assert(state.focusedTabs[window.id] == null);
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

    var index = state.windows.length;
    state.focusedTabs[window.id] = null;
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


function initialize(success, failure, Broadcaster, broadcast, WindowCreated, WindowClosed, WindowFocused, WindowUnfocused, TabCreated, TabClosed, TabFocused, TabUnfocused, TabMovedInSameWindow, TabMovedToOtherWindow, TabChanged) {
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
          assert(window.id === id);

          removeWindow(state, window, events);

          var closing = state.closingWindows[id];

          if (closing != null) {
            assert(events);

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
            assert(window.id === id);

            assert(window.focused === false);
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
          assert(window.id === tab.windowId);

          makeTab(state, window, tab, true, events);
        }
      });
    });

    chrome.tabs.onUpdated.addListener(function (id, changed, info) {
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
          assert(tab.index === info.index);
          assert(tab.incognito === info.incognito);

          updateTab(state, tab, info, events);
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
          assert(!tab.detached);
          assert(tab.id === info.tabId);
          assert(tab.windowId === info.windowId);

          var window = state.windowIds[tab.windowId];

          assert(window != null);
          assert(window.id === tab.windowId);

          unfocusFocusedTab(state, window, events);

          // This is only true when detaching + attaching a focused tab
          if (tab.active) {
            focusTab(state, window, tab);

          } else {
            tab.active = true;

            focusTab(state, window, tab);

            if (events) {
              state.TabFocused(tab);
            }
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
    });

    chrome.tabs.onMoved.addListener(function (id, info) {
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

          var window = state.windowIds[tab.windowId];

          assert(window != null);
          assert(window.id === tab.windowId);

          assert(window.tabs[tab.index] === tab);

          arrayRemoveIndex(window.tabs, tab.index);

          if (info.fromIndex < info.toIndex) {
            updateIndexes(window.tabs, info.fromIndex, info.toIndex, -1);

          } else {
            updateIndexes(window.tabs, info.toIndex, info.fromIndex, 1);
          }

          tab.index = info.toIndex;

          arrayInsertIndex(window.tabs, tab.index, tab);

          if (events) {
            state.TabMovedInSameWindow(tab, window, info.fromIndex, info.toIndex);
          }
        }
      });
    });

    chrome.tabs.onRemoved.addListener(function (id, info) {
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

            var window = state.windowIds[tab.windowId];

            assert(window != null);
            assert(window.id === info.windowId);

            assert(window.tabs[tab.index] === tab);

            // TODO should this send events ?
            unfocusTab(state, window, tab, false);

            arrayRemoveIndex(window.tabs, tab.index);
            updateIndexes(window.tabs, tab.index, window.tabs.length, -1);

            delete state.tabIds[id];

            if (events) {
              state.TabClosed(tab, window, tab.index);
            }
          }
        });
      }
    });

    chrome.tabs.onDetached.addListener(function (id, info) {
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

          var window = state.windowIds[tab.windowId];

          assert(window != null);
          assert(window.id === tab.windowId);

          assert(window.tabs[tab.index] === tab);

          // TODO code duplication with unfocusTab
          var focused = state.focusedTabs[window.id];

          if (tab.active) {
            assert(focused === tab);
            state.focusedTabs[window.id] = null;

          } else {
            assert(focused !== tab);
          }

          tab.detached = true;

          arrayRemoveIndex(window.tabs, tab.index);
          updateIndexes(window.tabs, tab.index, window.tabs.length, -1);
        }
      });
    });

    chrome.tabs.onAttached.addListener(function (id, info) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function (events) {
        var tab = state.tabIds[id];

        if (tab != null) {
          assert(tab.detached);
          assert(tab.id === id);
          assert(tab.windowId !== info.newWindowId);

          var oldWindow = state.windowIds[tab.windowId];
          var newWindow = state.windowIds[info.newWindowId];

          assert(oldWindow != null);
          assert(oldWindow.id === tab.windowId);

          assert(newWindow != null);
          assert(newWindow.id === info.newWindowId);

          var oldIndex = tab.index;

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
                  assert(state.closingWindows[window.id] == null);
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

                              chrome.windows.create(info, function (info) {
                                var err = getError();

                                if (err === null) {
                                  var window = windows.windowIds[info.id];

                                  assert(window != null);
                                  assert(window.id === info.id);

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
                            assert(false);
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
