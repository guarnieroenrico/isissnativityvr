/* Service worker: dopo la prima visita la natività si apre anche senza internet (il multiplayer però ha bisogno della rete).
   Dopo ogni aggiornamento del sito cambia il numero di CACHE qui sotto, così i visori scaricano i file nuovi. */
const CACHE = "nativita-v26";
const ASSETS = ["./", "index.html", "storia.html", "storia.js", "models/frist-scene.glb", "audio/scena1.mp3", "audio/scena2.mp3", "net.js", "logo.png", "garland.svg", "guida.png",
  "models/nativita.glb", "models/cow_idle.glb", "art/magi.jpg", "art/famiglia.jpg", "art/stella.jpg", "art/adorazione.jpg", "audio/canzone.mp3",
  "vendor/trystero.js", "vendor/qr.js", "vendor/three/three.module.js", "vendor/three/three.core.js",
  "vendor/three/addons/loaders/GLTFLoader.js", "vendor/three/addons/utils/BufferGeometryUtils.js", "vendor/three/addons/environments/RoomEnvironment.js",
  "vendor/three/addons/webxr/XREstimatedLight.js", "vendor/three/addons/libs/meshopt_decoder.module.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// risposta parziale (206) per l'audio, che chiede i file a pezzi
async function ranged(req, res){
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get("range") || "");
  if (!m || !res) return res;
  const buf = await res.arrayBuffer(), a = +m[1], b = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(a, b + 1), { status: 206, headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg", "Content-Range": `bytes ${a}-${b}/${buf.byteLength}`, "Content-Length": String(b - a + 1) } });
}
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req.headers.has("range") ? new Request(req.url) : req).then(r => { if (r && r.ok && r.status === 200) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return req.headers.has("range") ? ranged(req, hit) : hit; }   // dalla cache subito, e intanto aggiorna
    const r = await net;
    return r ? (req.headers.has("range") ? ranged(req, r) : r) : new Response("Offline", { status: 503 });
  })());
});
