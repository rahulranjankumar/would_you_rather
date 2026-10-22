/* Fun Friday Arena — service worker v29
   NETWORK-FIRST: pages and assets always come from the server when it is reachable,
   so a new deploy is live on the very next load. The cache is ONLY an offline fallback.
   (v27/v28 served the cached copy first, which kept old game code on phones after a deploy.)
   /api/*, SSE and cross-origin requests are never touched. */
const V='ffa-v29';
const CORE=['/join','/play'];
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(
  ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='warm'){e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>
    fetch(u,{credentials:'same-origin',cache:'no-store'}).then(r=>{if(r.ok)return c.put(u,r);}).catch(()=>{})))));}
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.startsWith('/api/')||u.pathname==='/healthz'||u.pathname==='/sw.js')return;
  const cacheable=u.pathname==='/join'||u.pathname==='/play'||u.pathname.startsWith('/assets/');
  if(!cacheable)return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{
      if(r.ok){const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp));}return r;})
    .catch(()=>caches.open(V).then(c=>c.match(e.request,{ignoreSearch:true}))));
});
