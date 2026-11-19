/* Service worker : reçoit les notifications push et ouvre la bonne page au clic. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: event.data ? event.data.text() : "BLACKLIST" }; }
  const title = String(d.title || "BLACKLIST").slice(0, 120);
  event.waitUntil(self.registration.showNotification(title, {
    body: String(d.body || "").slice(0, 300),
    icon: "/img/icon-512.png",
    badge: "/img/favicon.png",
    tag: d.tag || undefined,
    data: { url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/notifications" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
