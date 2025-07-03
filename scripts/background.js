const badgeApi = chrome.action || chrome.browserAction;

function authHandler(details, callback) {
  chrome.storage.local.get('proxyConfig', data => {
    const cfg = data.proxyConfig || {};
    setTimeout(() => {
      callback({
        authCredentials: {
			username: cfg.username || '',
			password: cfg.password || ''
        }
      });
    }, 400);
  });
}

function updateBadge(enabled) {
	badgeApi.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
	badgeApi.setBadgeBackgroundColor({
		color: enabled ? '#43B02A' : '#C8102F'
	});
}

function setProxy(cfg) {
	chrome.webRequest.onAuthRequired.removeListener(authHandler);
	chrome.webRequest.onAuthRequired.addListener(
		authHandler,
		{ urls: ['<all_urls>'] },
		['asyncBlocking']
	);

	const rules = {
			mode: 'fixed_servers',
			rules: {
			singleProxy: {
				scheme: cfg.scheme,
				host:   cfg.host,
				port:   cfg.port
			},
			bypassList: ['<local>']
			}
	};

	chrome.proxy.settings.set(
		{ value: rules, scope: 'regular' },
		() => {
		chrome.storage.local.set({
			proxyConfig:  cfg,
			proxyEnabled: true
		});
		updateBadge(true);
		}
	);
}

function disableProxy() {
	chrome.webRequest.onAuthRequired.removeListener(authHandler);

	chrome.proxy.settings.set(
		{ value: { mode: 'direct' }, scope: 'regular' },
		() => {
		chrome.storage.local.set({ proxyEnabled: false });
		updateBadge(false);
		}
	);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	switch (msg.action) {
		case 'applyProxy':
		if (msg.config) {
			setProxy(msg.config);
			sendResponse({ status: 'ok' });
		} else {
			chrome.storage.local.get('proxyConfig', data => {
			setProxy(data.proxyConfig);
			sendResponse({ status: 'ok' });
			});
			return true;
		}
		break;

		case 'disableProxy':
		disableProxy();
		sendResponse({ status: 'ok' });
		break;

		case 'getStatus':
		chrome.storage.local.get('proxyEnabled', data => {
			sendResponse({ enabled: !!data.proxyEnabled });
		});
		return true;

		default:
		sendResponse({ error: 'unknown action' });
	}
});

chrome.runtime.onStartup.addListener(() => {
	chrome.storage.local.get('proxyEnabled', data => {
		updateBadge(!!data.proxyEnabled);
	});
});