// Only cache same-origin static build assets. Never cache APIs, HTML or user records.
const CACHE = 'elara-assets-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async()=>{for(const key of await caches.keys()) if(key.startsWith('elara-assets-')&&key!==CACHE) await caches.delete(key); await self.clients.claim();})()));
self.addEventListener('fetch', event => {
  const u = new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith('/assets/')) return;
  event.respondWith((async()=>{const c=await caches.open(CACHE); const hit=await c.match(event.request); if(hit)return hit; const r=await fetch(event.request); if(r.ok)await c.put(event.request,r.clone());return r;})());
});
