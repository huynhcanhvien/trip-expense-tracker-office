// Service worker for web push only; the app itself is not cached offline.
self.addEventListener("activate", (event) => {
  // Control already-open tabs so a notification click can focus them.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Chia tiền văn phòng", {
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag,
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  );
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window" })
      .then((clients) => {
        const open = clients.find((c) => new URL(c.url).origin === url.origin);
        if (!open) return self.clients.openWindow(url.href);
        return open.navigate(url.href).then((c) => c && c.focus());
      })
      // navigate() rejects for tabs this worker does not control.
      .catch(() => self.clients.openWindow(url.href)),
  );
});
