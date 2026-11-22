// SideStage service worker: keeps the app working offline and refreshes saved copies in the background.
// Bump CACHE only when this file or the shell list (CRITICAL or ICONS) changes. Shell files are refreshed
// on every request, so a normal deploy needs no bump. A failed install deletes CACHE, so a changed file
// must not reuse the name of the worker that is still running.
const CACHE = 'sidestage-shell-v3';

// Relative URLs resolve against this script, so the folder also works from a subpath.
const absolute = (path) => new URL(path, self.location.href).href;
const INDEX_URL = absolute('./index.html');
const INDEX_PATH = new URL('./index.html', self.location.href).pathname;
const ROOT_PATH = new URL('./', self.location.href).pathname;
const MANIFEST_URL = absolute('./manifest.webmanifest');

// Files the app needs offline. If one of them cannot be saved, the install fails.
const CRITICAL = [INDEX_URL, MANIFEST_URL];
// Each icon is saved on its own, so a missing icon is logged without blocking offline use.
const ICONS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
].map(absolute);
// The exact URLs that may be cached. Every other request goes to the network.
const SHELL = new Set([...CRITICAL, ...ICONS]);
// Text that only the real app page contains, so a host error page is never saved as the index.
const APP_MARKER = 'id="app"';

// Chrome fails a navigation that receives a redirected response, so return a non-redirected copy.
function plain(res) {
  if (!res.redirected) return res;
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function looksLikeApp(res) {
  return (await res.clone().text()).includes(APP_MARKER);
}

// Saves res under url. The caller passes a copy it no longer needs.
// The no-store and private rule applies only to non-shell URLs.
async function saveCopy(url, res) {
  if (!res.ok) return;
  if (!SHELL.has(url) && /no-store|private/i.test(res.headers.get('Cache-Control') || '')) return;
  if (url === INDEX_URL && !(await looksLikeApp(res))) return;
  const cache = await caches.open(CACHE);
  await cache.put(url, plain(res));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // "reload" skips the browser HTTP cache, so a new version never saves stale files.
      const responses = await Promise.all(CRITICAL.map((url) => fetch(new Request(url, { cache: 'reload' }))));
      const bad = responses.findIndex((res) => !res.ok);
      if (bad !== -1) throw new Error(`${CRITICAL[bad]} returned ${responses[bad].status}`);
      if (!(await looksLikeApp(responses[0]))) throw new Error(`${INDEX_URL} is not the SideStage app`);
      await Promise.all(responses.map((res, i) => cache.put(CRITICAL[i], plain(res))));
    } catch (err) {
      await caches.delete(CACHE); // never leave a half-built cache behind
      throw err;
    }

    // Each icon is saved on its own. A failed icon is logged, and the install still succeeds.
    await Promise.allSettled(ICONS.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await saveCopy(url, res);
      } catch (err) {
        console.warn('SideStage: icon not cached', url, err);
      }
    }));
    self.skipWaiting(); // the critical files are saved, so this version may take over
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete only older SideStage shell caches, then take control of open pages.
    const names = await caches.keys();
    const stale = names.filter((name) => name.startsWith('sidestage-shell-') && name !== CACHE);
    await Promise.all(stale.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Answers a navigation to the app root or index.html. Called synchronously from the fetch listener, so
// event.waitUntil is registered during the fetch event itself.
function serveDocument(event) {
  // "no-cache" revalidates, so the browser HTTP cache cannot return an old index.
  const networkP = fetch(new Request(INDEX_URL, { cache: 'no-cache' }));
  // The saved copy is refreshed in the background. Its rejection is handled here.
  event.waitUntil(networkP.then((res) => saveCopy(INDEX_URL, res.clone())).catch(() => {}));

  const offline = () => new Response('SideStage is offline and has no saved copy yet.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
  return caches.open(CACHE)
    .then((cache) => cache.match(INDEX_URL))
    .catch(() => undefined) // a storage failure falls back to the network
    .then((saved) => saved || networkP.then(plain, offline));
}

// Answers an exact shell URL from the cache, and refreshes the saved copy from the network.
function staleWhileRevalidate(event, req) {
  const networkP = fetch(new Request(req.url, { cache: 'no-cache' }));
  event.waitUntil(networkP.then((res) => saveCopy(req.url, res.clone())).catch(() => {}));
  return caches.open(CACHE)
    .then((cache) => cache.match(req.url))
    .catch(() => undefined)
    .then((hit) => hit || networkP.then(plain));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Range requests pass through, so a partial request never gets a whole cached file.
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only the app root and index.html are answered from the cache. Other pages go to the network.
  if (req.mode === 'navigate') {
    if (url.pathname === ROOT_PATH || url.pathname === INDEX_PATH) event.respondWith(serveDocument(event));
    return;
  }
  if (SHELL.has(url.href)) event.respondWith(staleWhileRevalidate(event, req));
});
