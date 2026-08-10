import { registerSW } from 'virtual:pwa-register';

// A browser only checks a registered service worker for updates on its own
// schedule - by spec that can be as infrequent as once every 24h. That's
// fine for a page someone reloads often, but this is a POS app a shopkeeper
// typically leaves open all day at the counter: without forcing our own
// checks, a deploy could sit un-applied on an already-open tab for a full
// day. `registerType: 'autoUpdate'` (vite.config.js) already reloads the
// page automatically the moment a new worker takes over - polling here is
// what makes that "moment" arrive promptly instead of whenever the browser
// gets around to it.
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
    // Also check right away when the shopkeeper switches back to this tab -
    // covers a phone/tablet screen that was locked or backgrounded, which is
    // exactly when the interval above would have been paused by the OS.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});
