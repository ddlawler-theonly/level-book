// BlueWorks Level Book service worker: precache everything, cache-first, offline navigation fallback.
const CACHE = 'levelbook-v1.3.0-p2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './css/app.css', './js/app.js', './js/calc.js', './js/seed.js', './js/rod.js', './js/report.js', './js/plan.js', './js/ent.js', './js/pipe.js',
  './vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs',
  ...['FoxitDingbats.pfb', 'FoxitFixed.pfb', 'FoxitFixedBold.pfb', 'FoxitFixedBoldItalic.pfb', 'FoxitFixedItalic.pfb', 'FoxitSerif.pfb', 'FoxitSerifBold.pfb', 'FoxitSerifBoldItalic.pfb', 'FoxitSerifItalic.pfb', 'FoxitSymbol.pfb', 'LiberationSans-Bold.ttf', 'LiberationSans-BoldItalic.ttf', 'LiberationSans-Italic.ttf', 'LiberationSans-Regular.ttf'].map((f) => './vendor/pdfjs/standard_fonts/' + f),
  './vendor/jspdf.umd.min.js', './vendor/jspdf.plugin.autotable.min.js', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './docs/LevelBook-Manual.pdf'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
