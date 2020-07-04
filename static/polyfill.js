"use strict";

function promisify(f) {
    return function (...args) {
        return new Promise(function (resolve, reject) {
            f(...args, function (value) {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));

                } else {
                    resolve(value);
                }
            });
        });
    };
}

if (typeof browser === "undefined") {
    var browser = {};

    browser.runtime = {};
    browser.runtime.getURL = chrome.runtime.getURL;
    browser.runtime.onConnect = chrome.runtime.onConnect;

    browser.browserAction = {};
    browser.browserAction.onClicked = chrome.browserAction.onClicked;

    browser.windows = {};
    browser.windows.onCreated = chrome.windows.onCreated;
    browser.windows.onRemoved = chrome.windows.onRemoved;
    browser.windows.onFocusChanged = chrome.windows.onFocusChanged;
    browser.windows.getAll = promisify(chrome.windows.getAll);

    browser.tabs = {};
    browser.tabs.onCreated = chrome.tabs.onCreated;
    browser.tabs.onUpdated = chrome.tabs.onUpdated;
    browser.tabs.onReplaced = chrome.tabs.onReplaced;
    browser.tabs.onActivated = chrome.tabs.onActivated;
    browser.tabs.onDetached = chrome.tabs.onDetached;
    browser.tabs.onAttached = chrome.tabs.onAttached;
    browser.tabs.onMoved = chrome.tabs.onMoved;
    browser.tabs.onRemoved = chrome.tabs.onRemoved;

    browser.storage = {};
    browser.storage.local = {};
    browser.storage.local.get = promisify((a, f) => chrome.storage.local.get(a, f));
}
