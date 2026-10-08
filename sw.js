/* Gold HQ Control Center service worker — app shell only.
   Never caches data.json, auth.json, other JSON, or anything under avi/. */
const CACHE = 'cc-shell-v2';
const SHELL = [
  './',
  './index.html',
  './combined.html',
  './other-bots.html',
  './flowchart.html',
  './improvements.html',
  './login.html',
  './gate.js?v=2',
  './style.css?v=3',
  './pages.css?v=3',
  './app.js?v=12',
  './cc-common.js?v=1',
  './combined.js?v=7',
  './other.js?v=4',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function underAvi(url) {
  try {
    const p = new URL(url).pathname;
    return /\/avi(\/|$)/.test(p);
  } catch (e) {
    return false;
  }
}

function isJson(url) {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.json');
  } catch (e) {
    return false;
  }
}

function inScope(url) {
  try {
    const u = new URL(url);
    const scope = new URL('./', self.registration.scope);
    return u.origin === scope.origin && u.pathname.startsWith(scope.pathname);
  } catch (e) {
    return false;
  }
}

function isShell(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const base = new URL('./', self.registration.scope).pathname;
    const rel = path.slice(base.length);
    if (!rel || rel === '' || /^(index|combined|other-bots|flowchart|improvements|login)\.html$/.test(rel)) return true;
    if (/^(gate\.js|style\.css|pages\.css|app\.js|cc-common\.js|combined\.js|other\.js|manifest\.webmanifest|sw\.js)$/.test(rel.split('?')[0])) return true;
    if (/^icons\//.test(rel)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Pass through untouched (no respondWith) for these:
  if (req.method !== 'GET') return;
  if (!inScope(url)) return;
  if (underAvi(url)) return;
  if (isJson(url)) return;
  if (!isShell(url)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
