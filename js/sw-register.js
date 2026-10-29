/* Service-worker registration for the hosted (PWA) build.
 *
 * Only runs on http/https origins. The desktop shell serves the same page from
 * its own app:// scheme and a plain file:// open has no service-worker support,
 * so on both of those this file is a deliberate no-op and desktop behaviour is
 * untouched.
 *
 * Registration waits for the page to finish loading so it never competes with
 * the first paint. A failure (old browser, non-secure context) is logged and
 * ignored: the quiz works fine without offline caching, it just needs the
 * network like any web page.
 */
'use strict';

if (['http:', 'https:'].includes(location.protocol) && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('service worker not registered:', err && err.message ? err.message : err);
    });
  });
}
