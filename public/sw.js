/* global self, clients */

const DEFAULT_URL = "/otrogato";
const DEFAULT_TITLE = "Diferencias";

function getSafeTarget(value) {
  try {
    const target = new URL(typeof value === "string" ? value : DEFAULT_URL, self.location.origin);

    if (
      target.origin !== self.location.origin ||
      target.username ||
      target.password ||
      (target.pathname !== "/otrogato" && !target.pathname.startsWith("/otrogato/"))
    ) {
      return new URL(DEFAULT_URL, self.location.origin);
    }

    return target;
  } catch {
    return new URL(DEFAULT_URL, self.location.origin);
  }
}

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.slice(0, 120)
      : DEFAULT_TITLE;
  const body =
    typeof payload.body === "string" ? payload.body.slice(0, 240) : "";
  const target = getSafeTarget(payload.url);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url: `${target.pathname}${target.search}${target.hash}` },
      icon: "/icons/otrogato-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = getSafeTarget(event.notification.data?.url);

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      const sameOriginWindows = windows.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      const appWindow =
        sameOriginWindows.find((client) =>
          new URL(client.url).pathname.startsWith("/otrogato")
        ) ?? sameOriginWindows[0];

      if (appWindow) {
        try {
          const navigatedWindow = await appWindow.navigate(target.href);
          await (navigatedWindow ?? appWindow).focus();
          return;
        } catch {
          // Fall through to opening a fresh window.
        }
      }

      await clients.openWindow(target.href);
    })()
  );
});
