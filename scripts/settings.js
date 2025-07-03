document.addEventListener("DOMContentLoaded", () => {
    const schemeEl   = document.getElementById("scheme");
    const hostEl     = document.getElementById("host");
    const portEl     = document.getElementById("port");
    const userEl     = document.getElementById("username");
    const passEl     = document.getElementById("password");
    const enableBtn  = document.getElementById("enable");
    const disableBtn = document.getElementById("disable");
    const statusEl   = document.getElementById("status");

    function renderStatus(isOn) {
        statusEl.value = isOn;
        statusEl.setAttribute("status", isOn);
    }

    chrome.storage.local.get(
        ["proxyConfig", "proxyEnabled"],
        data => {
        if (data.proxyConfig) {
            const cfg = data.proxyConfig;
            schemeEl.value = cfg.scheme;
            hostEl.value   = cfg.host;
            portEl.value   = cfg.port;
            userEl.value   = cfg.username;
            passEl.value   = cfg.password;
        }
        renderStatus(!!data.proxyEnabled);
        }
    );

    enableBtn.addEventListener("click", () => {
        const cfg = {
        scheme:   schemeEl.value,
        host:     hostEl.value,
        port:     parseInt(portEl.value, 10),
        username: userEl.value,
        password: passEl.value
        };

        chrome.runtime.sendMessage(
        { action: "applyProxy", config: cfg },
        resp => {
            if (resp.status === "ok") renderStatus(true);
        }
        );
    });

    disableBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
        { action: "disableProxy" },
        resp => {
            if (resp.status === "ok") renderStatus(false);
        }
        );
    });
});