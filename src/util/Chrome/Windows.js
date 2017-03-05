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
    f();

  } else {
    state.pending.push(f);
  }
}


function unfocusWindow(state) {
  if (state.focusedWindow !== null) {
    console.assert(state.focusedWindow.focused === true);
    state.focusedWindow.focused = false;
    state.focusedWindow = null;
  }
}


function focusWindow(state, window) {
  console.assert(window.focused === true);
  console.assert(state.focusedWindow !== window);

  state.focusedWindow = window;
}


function removeWindow(state, window) {
  console.assert(window.tabs.length === 0);

  if (window.focused) {
    console.assert(state.focusedWindow === window);
    // TODO is this correct ?
    unfocusWindow(state);

  } else {
    console.assert(state.focusedWindow !== window);
  }

  arrayRemove(state.windows, window);

  delete state.windowIds[window.id];
}


function makeWindow(state, window) {
  if (window.type === "normal" ||
      window.type === "popup") {
    console.assert(state.windowIds[window.id] == null);

    if (window.focused) {
      unfocusWindow(state);
      focusWindow(state, window);
    }

    if (window.tabs == null) {
      window.tabs = [];
    }

    state.windowIds[window.id] = window;
    state.windows.push(window);

    window.tabs.forEach(function (tab) {
      makeTab(state, tab, window);
    });
  }
}


function makeTab(state, tab, window) {

}


function initialize(success, failure) {
  var state = {
    pending: [],
    closingWindows: {},
    focusedWindow: null,
    windowIds: {},
    windows: []
  };

  // TODO is this needed ?
  onLoaded(function () {
    // TODO use a filter ?
    chrome.windows.onCreated.addListener(function (window) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function () {
        makeWindow(state, window);
      });
    });

    // TODO use a filter ?
    chrome.windows.onRemoved.addListener(function (id) {
      throwError();

      // TODO is this correct ?
      // TODO test this
      onInit(state, function () {
        var window = state.windowIds[id];

        if (window != null) {
          removeWindow(state, window);

          var closing = state.closingWindows[id];

          if (closing != null) {
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
      onInit(state, function () {
        unfocusWindow(state);

        if (id !== chrome.windows.WINDOW_ID_NONE) {
          var window = state.windowIds[id];

          if (window != null) {
            console.assert(window.focused === false);
            window.focused = true;

            focusWindow(state, window);
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
          makeWindow(state, window);
        });

        // TODO is this correct ?
        // TODO test this
        state.pending.forEach(function (f) {
          f();
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


exports.makeNewWindowImpl = function (unit) {
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

                                  console.assert(window != null);

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
    return makeAff(function (failure) {
      return function (success) {
        return function () {
          initialize(success, failure);
          return unit;
        };
      };
    });
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
