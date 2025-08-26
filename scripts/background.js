const badgeApi = chrome.action || chrome.browserAction;

let _authListenerRegistered = false;

function authHandler(details, callback) {
  chrome.storage.local.get("proxyConfig", data => {
    const cfg = data.proxyConfig || {};
    setTimeout(() => {
      callback({
        authCredentials: {
          username: cfg.username || "",
          password: cfg.password || ""
        }
      });
    }, 400);
  });
}

function ensureAuthHandler() {
  if (!_authListenerRegistered) {
    chrome.webRequest.onAuthRequired.addListener(
      authHandler,
      { urls: ["<all_urls>"] },
      ["asyncBlocking"]
    );
    _authListenerRegistered = true;
  }
}

function updateBadge(enabled) {
  badgeApi.setBadgeText({ text: enabled ? "ON" : "OFF" });
  badgeApi.setBadgeBackgroundColor({
    color: enabled ? "#43B02A" : "#C8102F"
  });
}

function setProxy(cfg) {
  chrome.proxy.settings.clear({ scope: "regular" }, () => {
    ensureAuthHandler();

    const rules = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: cfg.scheme,
          host:   cfg.host,
          port:   cfg.port
        },
        bypassList: ["<local>"]
      }
    };

    chrome.proxy.settings.set(
      { value: rules, scope: "regular" },
      () => {
        chrome.storage.local.set(
          { proxyConfig: cfg, proxyEnabled: true },
          () => updateBadge(true)
        );
      }
    );
  });
}

function disableProxy() {
  if (_authListenerRegistered) {
    chrome.webRequest.onAuthRequired.removeListener(authHandler);
    _authListenerRegistered = false;
  }

  chrome.proxy.settings.set(
    { value: { mode: "direct" }, scope: "regular" },
    () => {
      chrome.storage.local.set({ proxyEnabled: false }, () =>
        updateBadge(false)
      );
    }
  );
}

function enableProxy(sendResponse) {
  chrome.storage.local.get("proxyConfig", data => {
    const cfg = data.proxyConfig;
    if (cfg) {
      setProxy(cfg);
      sendResponse({ status: "ok" });
    } else {
      sendResponse({ status: "error", error: "noConfig" });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.action) {
    case "setProxy":
      if (msg.config) {
        setProxy(msg.config);
        sendResponse({ status: "ok" });
      } else {
        chrome.storage.local.get("proxyConfig", data => {
          if (data.proxyConfig) {
            setProxy(data.proxyConfig);
            sendResponse({ status: "ok" });
          } else {
            sendResponse({ status: "error", error: "noConfig" });
          }
        });
        return true;
      }
      break;

    case "enableProxy":
      enableProxy(sendResponse);
      return true;

    case "disableProxy":
      disableProxy();
      sendResponse({ status: "ok" });
      break;

    case "getStatus":
      chrome.storage.local.get("proxyEnabled", data => {
        sendResponse({ enabled: !!data.proxyEnabled });
      });
      return true;

    default:
      sendResponse({ error: "unknownAction" });
  }
});

function restoreProxySettings() {
  chrome.storage.local.get(
    ["proxyEnabled", "proxyConfig"],
    ({ proxyEnabled, proxyConfig }) => {

      if (_authListenerRegistered) {
        chrome.webRequest.onAuthRequired.removeListener(authHandler);
        _authListenerRegistered = false;
      }

      if (proxyEnabled && proxyConfig) {
        ensureAuthHandler();
        const rules = {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: proxyConfig.scheme,
              host:   proxyConfig.host,
              port:   proxyConfig.port
            },
            bypassList: ["<local>"]
          }
        };

        chrome.proxy.settings.set(
          { value: rules, scope: "regular" },
          () => {
            updateBadge(true);
            console.log("Proxy restored as ON");
          }
        );
      } else {
        chrome.proxy.settings.set(
          { value: { mode: "direct" }, scope: "regular" },
          () => {
            updateBadge(false);
            console.log("Proxy restored as OFF");
          }
        );
      }
    }
  );
}

chrome.runtime.onStartup.addListener(restoreProxySettings);
chrome.runtime.onInstalled.addListener(restoreProxySettings);