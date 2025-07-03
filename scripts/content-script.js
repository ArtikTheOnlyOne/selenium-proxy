window.addEventListener("message", event => {
    if (
        event.source !== window ||
        !event.data ||
        event.data.direction !== "toExtension"
    ) return;

    chrome.runtime.sendMessage(event.data.msg, response => {
        window.postMessage(
        { direction: "fromExtension", response },
        "*"
        );
    });
});