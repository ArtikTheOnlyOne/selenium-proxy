import time
from selenium import webdriver

PROXY = {
    "scheme":"http",
    "username":"artiktheonlyone",
    "password":"mysuperpassword",
    "host":"proxy.com",
    "port":1337
}

SET_PROXY = """
        window.postMessage({{
            direction: "toExtension",
            msg: {{
                action: "setProxy",
                config: {{
                    scheme:   "{scheme}",
                    host:     "{host}",
                    port:      {port},
                    username: "{username}",
                    password: "{password}"
                }}
            }}
        }}, "*");
    """

ENABLE_PROXY = """
        window.postMessage({
            direction: "toExtension",
            msg: { action: "enableProxy" }
        }, "*");
    """

DISABLE_PROXY = """
        window.postMessage({
            direction: "toExtension",
            msg: { action: "disableProxy" }
        }, "*");
    """

STATUS = """
        const callback = arguments[0];
        window.addEventListener("message", function handler(e) {
            if (e.data.direction === "fromExtension") {
                window.removeEventListener("message", handler);
                callback(e.data.response.enabled);
            }
        });
        window.postMessage({ direction: "toExtension", msg: { action: "getStatus" } }, "*");
    """

options = webdriver.ChromeOptions()

options.add_argument("--load-extension=/path/to/extension/")
options.add_argument("--disable-extensions-except=/path/to/extension/") #you may have to do it if you load an unpacked extension

driver = webdriver.Chrome(options=options)

driver.get("https://api.ipify.org/") #what you see depends on whether you enabled proxy before

print(driver.execute_async_script(STATUS)) #you see your last proxy status

#setting proxy

driver.execute_script(SET_PROXY.format(
    scheme=PROXY["scheme"],
    username=PROXY["username"],
    password=PROXY["password"],
    host=PROXY["host"],
    port=PROXY["port"])
    )

time.sleep(4) #proxies need some time to be actually applied

print(driver.execute_async_script(STATUS)) #proxies are on

driver.refresh() # you see your proxy

#disabling proxy

driver.execute_script(DISABLE_PROXY)

print(driver.execute_async_script(STATUS)) #proxies are off

driver.refresh() # you see your own IP

#enabling proxy

driver.execute_script(ENABLE_PROXY)

print(driver.execute_async_script(STATUS)) #proxies are on

driver.refresh() # you see your proxy

driver.close()
driver.quit()