const badgeApi = chrome.action || chrome.browserAction;

let _authListenerRegistered = false;
let _cachedAuth = { username: "", password: "" };

function updateAuthCache(config) {
    _cachedAuth.username = config.username || "";
    _cachedAuth.password = config.password || "";
}

function authHandler(details, callback) {
    callback({
        authCredentials: {
            username: _cachedAuth.username,
            password: _cachedAuth.password
        }
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

async function checkConnectivity() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch('http://www.gstatic.com/generate_204', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        return response.status === 204 || response.status === 200;
    } catch (err) {
        console.warn("Connectivity check failed:", err);
        return false;
    }
}

function updateBadge(enabled) {
    badgeApi.setBadgeText({ text: enabled ? "ON" : "OFF" });
    badgeApi.setBadgeBackgroundColor({
        color: enabled ? "#43B02A" : "#C8102F"
    });
}

function disableProxy(updateStorage = true) {
    if (_authListenerRegistered) {
        chrome.webRequest.onAuthRequired.removeListener(authHandler);
        _authListenerRegistered = false;
    }

    chrome.proxy.settings.set(
        { value: { mode: "direct" }, scope: "regular" },
        () => {
        if (updateStorage) {
            chrome.storage.local.set({ proxyEnabled: false }, () =>
            updateBadge(false)
            );
        } else {
            updateBadge(false);
        }
        }
    );
}

function setProxy(cfg, sendResponse = null) {
    updateAuthCache(cfg);

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
            badgeApi.setBadgeText({ text: "..." });
            badgeApi.setBadgeBackgroundColor({ color: "#FFC107" });

            setTimeout(async () => {
                const isWorking = await checkConnectivity();

                if (isWorking) {
                chrome.storage.local.set(
                    { proxyConfig: cfg, proxyEnabled: true },
                    () => {
                        updateBadge(true);
                        if (sendResponse) sendResponse({ status: "ok" });
                    }
                );
                } else {
                    console.error("Proxy connection failed check. Disabling.");
                    disableProxy(true);
                    if (sendResponse) sendResponse({ status: "error", error: "connectionFailed" });
                }
            }, 800); 
        }
        );
    });
}

function enableProxy(sendResponse) {
    chrome.storage.local.get("proxyConfig", data => {
        const cfg = data.proxyConfig;
        if (cfg) {
            setProxy(cfg, sendResponse);
        } else {
            sendResponse({ status: "error", error: "noConfig" });
        }
    });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
        case "setProxy":
        if (msg.config) {
            setProxy(msg.config, sendResponse);
        } else {
            chrome.storage.local.get("proxyConfig", data => {
            if (data.proxyConfig) {
                setProxy(data.proxyConfig, sendResponse);
            } else {
                sendResponse({ status: "error", error: "noConfig" });
            }
            });
        }
        return true;

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
            updateAuthCache(proxyConfig);
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
                console.log("Proxy settings restored. Checking connectivity...");
                setTimeout(async () => {
                    const isWorking = await checkConnectivity();
                    if (isWorking) {
                        updateBadge(true);
                        console.log("Proxy restored and working.");
                    } else {
                        console.error("Restored proxy is not working. Disabling.");
                        disableProxy(true); 
                    }
                }, 800);
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