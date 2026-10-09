/* ============================================================
   sw.js — Service Worker برای تحلیلگر کدال
   نسخه: v1.3.0-beta
   استراتژی:
   - App Shell (index.html, CSS, JS, فونت‌ها): Cache First
   - سایر فایل‌ها: Network First با fallback به cache
============================================================ */

const CACHE_VERSION = 'kodal-v1.5.1-beta';
const CACHE_NAME = CACHE_VERSION;

// فایل‌های اصلی که همیشه کش می‌شن (App Shell)
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './compare.js',
  './watchlist.js',
  './license.js',
  './styles.css',
  './Vazirmatn-font-face.css',
  './xlsx.full.min.js',
  './manifest.json'
];

// نصب: کش کردن App Shell
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installing', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 SW: Caching App Shell');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch((err) => {
        console.error('❌ SW: Cache failed', err);
      })
  );
  // فعال‌سازی فوری نسخه جدید
  self.skipWaiting();
});

// فعال‌سازی: پاک کردن کش‌های قدیمی
self.addEventListener('activate', (event) => {
  console.log('✅ SW: Activating', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key.startsWith('kodal-') && key !== CACHE_NAME)
            .map(key => {
              console.log('🗑️ SW: Deleting old cache', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: استراتژی ترکیبی
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط درخواست‌های GET رو مدیریت کن
  if(request.method !== 'GET') return;

  // فقط از همون دامنه (خودمون)
  if(url.origin !== self.location.origin) return;

  // فایل‌های App Shell: Cache First
  const isAppShell = PRECACHE_URLS.some(p => {
    const normalized = p.replace('./', '');
    return url.pathname.endsWith(normalized) || url.pathname.endsWith('/');
  });

  if(isAppShell){
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if(cached) return cached;
          return fetch(request).then(response => {
            if(response && response.status === 200){
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
            }
            return response;
          });
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // بقیه فایل‌ها: Network First
  event.respondWith(
    fetch(request)
      .then(response => {
        if(response && response.status === 200 && response.type === 'basic'){
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          if(cached) return cached;
          // اگه فایل HTML خواست و آفلاین بود، index.html برگردون
          if(request.destination === 'document'){
            return caches.match('./index.html');
          }
        });
      })
  );
});

// پیام از صفحه: پاک کردن کش و رفرش
self.addEventListener('message', (event) => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
  if(event.data && event.data.type === 'CLEAR_CACHE'){
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
});