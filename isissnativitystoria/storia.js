/* Storia – Scena 1: i Re Magi nel deserto guardano la stella cometa. Codice unico per la pagina e per l'anteprima. */
(function () {
const T = window.THREEX || window.THREE, rev = parseInt(T.REVISION), $ = s => document.querySelector(s);
const C = hex => { const c = new T.Color(hex); if (rev < 152) c.convertSRGBToLinear(); return c; };   // i colori esadecimali sono sRGB: nelle versioni vecchie vanno convertiti
const srgb = t => { if (rev >= 152) t.colorSpace = T.SRGBColorSpace; else t.encoding = T.sRGBEncoding; return t; };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const QS = new URLSearchParams(location.search), HEADSET = /OculusBrowser|Quest|Pico|Wolvic|VIVE|Oculus/i.test(navigator.userAgent);
let LOW = HEADSET || QS.has('vr') || QS.has('low'), VRMODE = false;   // LOW = versione leggera per il visore; VRMODE = sul visore si entra direttamente in VR, senza anteprima
const aniso = () => LOW ? 2 : 8, XR_SCALE = 0.9;   // XR_SCALE = nitidezza nel visore (1 = massima, 0.8 = più veloce)
const R = mulberry(20251225), gauss = () => (R() + R() + R() - 1.5) * 1.6;
const smooth = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };

/* ---------- rumore periodico (la texture della sabbia si ripete senza giunzioni) ---------- */
function noiseTile(N, seed) {
  const r = mulberry(seed), v = new Float32Array(N * N).map(() => r());
  return (x, y) => { x *= N; y *= N; const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy),
    a = v[(yi % N) * N + xi % N], b = v[(yi % N) * N + (xi + 1) % N], c = v[((yi + 1) % N) * N + xi % N], d = v[((yi + 1) % N) * N + (xi + 1) % N];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
}

/* ---------- sabbia: colore + rilievo (increspature del vento + grani) ---------- */
function makeSand(base, ra) {   // base = colore della terra, ra = quanto sono marcate le increspature
  base = base || [222, 182, 128]; ra = ra == null ? 1 : ra;
  const S = 512, n1 = noiseTile(6, 1), n2 = noiseTile(24, 2), n3 = noiseTile(96, 3), n4 = noiseTile(256, 4), H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, warp = n1(u, v) * .5 + n2(u, v) * .08;
    const rip = Math.pow(.5 + .5 * Math.sin(6.2832 * (8 * u + 3 * v + warp * 3)), 1.7);
    H[y * S + x] = rip * .6 * ra + n2(u, v) * .18 + n3(u, v) * .1 + n4(u, v) * .1;
  }
  const col = document.createElement('canvas'), nor = document.createElement('canvas'); col.width = col.height = nor.width = nor.height = S;
  const cg = col.getContext('2d'), ng = nor.getContext('2d'), ci = cg.createImageData(S, S), ni = ng.createImageData(S, S), h = (x, y) => H[((y + S) % S) * S + (x + S) % S];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), k = 2.4, l = Math.hypot(dx * k, dy * k, 1), g = H[y * S + x], f = .62 + .75 * g + (R() - .5) * .16;
    ni.data[i] = (-dx * k / l * .5 + .5) * 255; ni.data[i + 1] = (dy * k / l * .5 + .5) * 255; ni.data[i + 2] = (1 / l * .5 + .5) * 255; ni.data[i + 3] = 255;
    ci.data[i] = Math.min(255, base[0] * f); ci.data[i + 1] = Math.min(255, base[1] * f); ci.data[i + 2] = Math.min(255, base[2] * f); ci.data[i + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); ng.putImageData(ni, 0, 0);
  const mk = (c, s) => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(350, 350); t.anisotropy = aniso(); return s ? srgb(t) : t; };
  return { map: mk(col, true), normalMap: mk(nor, false) };
}

/* ---------- cielo: stelle, Via Lattea, bagliore dell'orizzonte (tutto nello shader) ---------- */
const SKY_FS = `uniform float t; varying vec3 vD;
float h(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+1.7;a*=.5;}return s;}
vec3 stars(vec3 d,float sc,float dens,float rad,float br){vec3 p=d*sc,i=floor(p),f=fract(p);float r=h(i);if(r>dens)return vec3(0.);
 vec3 o=.2+.6*vec3(h(i+3.1),h(i+7.7),h(i+1.3));float dist=length(f-o);float tw=.82+.18*sin(t*(2.+r*30.)+r*100.);float m=(pow(h(i+9.9),3.)+.15)*br;
 return mix(vec3(1.,.82,.62),vec3(.68,.8,1.),h(i+5.5))*m*tw*smoothstep(rad,0.,dist);}
void main(){vec3 d=normalize(vD);float y=d.y;
 vec3 col=mix(vec3(.07,.095,.18),vec3(.005,.011,.038),pow(clamp(y,0.,1.),.5));
 col+=vec3(.2,.11,.05)*exp(-abs(y)*13.)*.5;
 vec3 n=normalize(vec3(.3,.78,.55));float b=dot(d,n),band=exp(-b*b/.05),cl=fbm(d*3.2+4.),dust=smoothstep(.35,.7,fbm(d*8.+11.));
 float vis=smoothstep(-.02,.1,y);
 col+=mix(vec3(.5,.58,.85),vec3(1.,.8,.58),smoothstep(.3,.9,cl))*band*(.2+.9*cl)*(1.-.75*dust)*.34*vis;
 vec3 s=stars(d,38.,.07,.035,2.4)+stars(d,90.,.13,.05,1.5)+stars(d,210.,.16,.09,1.05)+stars(d,430.,.5,.14,.9)*(.25+band*2.2);
 gl_FragColor=vec4(col+s*vis,1.);}`;

/* ---------- la stella cometa: nucleo, raggi, alone e coda di polvere e ioni ---------- */
function glowTex(stops) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(s => r.addColorStop(s[0], s[1])); g.fillStyle = r; g.fillRect(0, 0, 256, 256); return srgb(new T.CanvasTexture(c)); }
function spikeTex() { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.translate(256, 256);
  [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, .35], [-Math.PI / 4, .35]].forEach(([a, k]) => { g.save(); g.rotate(a); const l = g.createLinearGradient(-256, 0, 256, 0);
    l.addColorStop(0, 'rgba(255,230,180,0)'); l.addColorStop(.5, `rgba(255,244,220,${.9 * k})`); l.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = l; g.fillRect(-256, -2.2 * k, 512, 4.4 * k); g.restore(); });
  return srgb(new T.CanvasTexture(c)); }
function makeComet(head, tdir) {
  const G = new T.Group(); G.position.copy(head);
  const sp = (tex, size, op, col) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false })); s.scale.setScalar(size); G.add(s); return s; };
  const soft = glowTex([[0, 'rgba(255,255,255,1)'], [.12, 'rgba(255,244,215,.95)'], [.35, 'rgba(255,205,130,.35)'], [1, 'rgba(255,170,80,0)']]);
  const halo = glowTex([[0, 'rgba(255,220,160,.55)'], [.4, 'rgba(255,190,120,.14)'], [1, 'rgba(255,160,80,0)']]);
  const halo2 = sp(halo, 34, .55, 0xffffff), spikes = sp(spikeTex(), 26, .85, 0xffffff), core = sp(soft, 5.2, 1, 0xffffff);
  const td = (tdir || new T.Vector3(.1, -.42, .9)).clone().normalize(), cv = new T.Vector3(0, .6, -.25).normalize(), L = 95, pt = glowTex([[0, 'rgba(255,255,255,1)'], [.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
  const layer = (n, size, op, spread, c0, pw) => { const p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const s = Math.pow(R(), pw), k = Math.pow(1 - s, 2.3) * (.55 + .45 * R()), sd = spread * (.12 + s);
      p[i * 3] = td.x * L * s + cv.x * L * .22 * s * s + gauss() * sd; p[i * 3 + 1] = td.y * L * s + cv.y * L * .22 * s * s + gauss() * sd; p[i * 3 + 2] = td.z * L * s + cv.z * L * .22 * s * s + gauss() * sd;
      c[i * 3] = c0[0] * k; c[i * 3 + 1] = c0[1] * k; c[i * 3 + 2] = c0[2] * k; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
    G.add(new T.Points(g, new T.PointsMaterial({ size, map: pt, vertexColors: true, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }))); };
  layer(260, 6.5, .32, 2.6, [.55, .4, .22], 1); layer(520, 2.2, .55, .9, [.95, .8, .55], 1); layer(420, 1.1, .8, .3, [.6, .75, 1], 1);
  return { group: G, update: t => { core.scale.setScalar(5.2 * (1 + .06 * Math.sin(t * 2.3) + .03 * Math.sin(t * 5.1))); spikes.material.rotation = t * .02; spikes.scale.setScalar(26 * (1 + .05 * Math.sin(t * 1.7))); } };
}


const makeSky = () => { const m = new T.Mesh(new T.SphereGeometry(600, 48, 32), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: SKY_FS })); m.renderOrder = -1; return m; };
/* nel visore il cielo (shader pesante) viene disegnato UNA volta sola in un cubo e poi si legge solo quello: costa quasi niente */
let SKYRT = null;
function skyFor() {
  if (!LOW) return makeSky();
  if (!SKYRT) { SKYRT = new T.WebGLCubeRenderTarget(1024); const bs = new T.Scene(), s0 = makeSky(); s0.material.uniforms.t.value = 1.7; bs.add(s0); new T.CubeCamera(1, 2000, SKYRT).update(renderer, bs); s0.geometry.dispose(); s0.material.dispose(); }
  const m = new T.Mesh(new T.SphereGeometry(600, 24, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: 0 }, cube: { value: SKYRT.texture } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform samplerCube cube; varying vec3 vD; void main(){ gl_FragColor = vec4(textureCube(cube, normalize(vD)).rgb, 1.); }' }));
  m.renderOrder = -1; m.frustumCulled = false; return m;
}
function makeTerrain(mat, flatR, amp, seed) {
  const nb = noiseTile(14, seed), nb2 = noiseTile(7, seed + 2), tg = new T.PlaneGeometry(700, 700, LOW ? 140 : 280, LOW ? 140 : 280); tg.rotateX(-Math.PI / 2); const p = tg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), u = x / 700 + .5, v = z / 700 + .5, m = smooth(flatR, flatR + 74, Math.hypot(x, z));
    p.setY(i, m * amp * (nb(u, v) * 9 + Math.pow(Math.sin(x * .035 + z * .013 + nb2(u, v) * 7) * .5 + .5, 2.2) * 4.5 + nb2(u * 3 % 1, v * 3 % 1) * 2 - 4)); }
  tg.computeVertexNormals(); const g = new T.Mesh(tg, mat); g.receiveShadow = true; return g;
}
const C0 = hex => C(hex);
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = srgb(new T.CanvasTexture(c)); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = aniso(); return t; }
const stoneTex = () => canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#5a5249'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 230; i++) { const x = R() * w, y = R() * h, rw = 34 + R() * 64, rh = 22 + R() * 34; g.fillStyle = `hsl(${26 + R() * 16},${7 + R() * 10}%,${34 + R() * 26}%)`; g.fillRect(x, y, rw, rh); g.strokeStyle = 'rgba(18,14,10,.6)'; g.lineWidth = 3; g.strokeRect(x, y, rw, rh); }
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${R() > .5 ? 255 : 0},${R() > .5 ? 255 : 0},0,.04)`; g.fillRect(R() * w, R() * h, 2, 2); } }, [3, 1]);
const woodTex = () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4a3220'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 64) { g.fillStyle = `hsl(${22 + R() * 6},${30 + R() * 10}%,${20 + R() * 10}%)`; g.fillRect(x, 0, 62, h); g.fillStyle = '#17100a'; g.fillRect(x + 62, 0, 2, h); }
  for (let i = 0; i < 380; i++) { g.strokeStyle = `rgba(20,10,4,${.1 + R() * .2})`; g.lineWidth = 1; const x = R() * w; g.beginPath(); g.moveTo(x, R() * h); g.lineTo(x + R() * 4 - 2, R() * h); g.stroke(); } }, [1, 1]);
const thatchTex = () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#6e5424'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4200; i++) { g.strokeStyle = `hsl(${34 + R() * 14},${45 + R() * 30}%,${22 + R() * 34}%)`; g.lineWidth = 1 + R() * 1.8; const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R() * 8 - 4, y + 26 + R() * 46); g.stroke(); } }, [2, 2]);
const beamTex = () => { const c = document.createElement('canvas'); c.width = 8; c.height = 256; const g = c.getContext('2d'), l = g.createLinearGradient(0, 0, 0, 256);
  l.addColorStop(0, 'rgba(255,232,180,.02)'); l.addColorStop(.45, 'rgba(255,226,165,.30)'); l.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = l; g.fillRect(0, 0, 8, 256); return srgb(new T.CanvasTexture(c)); };

/* ---------- caricamento GLB (file oppure base64 incorporato nell'anteprima) ---------- */
const FILES = { desert: 'models/frist-scene.glb', nat: 'models/nativita.glb', cow: 'models/cow_idle.glb' };
function loadGLB(key, onProg) {
  const loader = new T.GLTFLoader(), MD = T.MeshoptDecoder || (typeof MeshoptDecoder !== 'undefined' ? MeshoptDecoder : null); if (MD) loader.setMeshoptDecoder(MD);
  return new Promise((ok, ko) => {
    const b64 = (window.GLB64 || {})[key];
    if (b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); loader.parse(u.buffer, '', ok, ko); }
    else loader.load(FILES[key], ok, e => e.total && onProg && onProg(e.loaded / e.total), ko);
  });
}

/* ---------- renderer, camera, comandi ---------- */
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
if (rev >= 152) renderer.outputColorSpace = T.SRGBColorSpace; else renderer.outputEncoding = T.sRGBEncoding;
if ('useLegacyLights' in renderer) renderer.useLegacyLights = false; else renderer.physicallyCorrectLights = true;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.shadowMap.enabled = true; renderer.shadowMap.type = LOW ? T.PCFShadowMap : T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = !LOW; renderer.xr.enabled = true;   // nel visore le ombre si calcolano una volta per scena, non a ogni fotogramma
document.body.prepend(renderer.domElement);
const camera = new T.PerspectiveCamera(58, innerWidth / innerHeight, LOW ? .1 : .05, LOW ? 900 : 1500), status = $('#status');
const D = { az: 0, pitch: 0, rad: 0 }, pos = new T.Vector3(), dir = new T.Vector3();
let drag = null;
addEventListener('pointerdown', e => { if (e.target.closest('button,a')) return; drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!drag) return; D.az -= (e.clientX - drag.x) * .0045; D.pitch = Math.min(.55, Math.max(-.12, D.pitch + (e.clientY - drag.y) * .0025)); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => drag = null); addEventListener('pointercancel', () => drag = null);
addEventListener('wheel', e => { D.rad = Math.min(6, Math.max(-5, D.rad + e.deltaY * .004)); }, { passive: true });
addEventListener('resize', () => { if (renderer.xr.isPresenting) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.fov = innerHeight > innerWidth ? 74 : 58; camera.updateProjectionMatrix(); });
dispatchEvent(new Event('resize'));
const prog = label => p => { if (status) status.textContent = label + Math.round(p * 100) + '%'; };
const std = o => new T.MeshStandardMaterial(o);

/* =====================  SCENA 1 · il deserto  ===================== */
function buildDesert() {
  const scene = new T.Scene(); scene.fog = new T.FogExp2(C(0x232234), .0072);
  const sky = skyFor(); scene.add(sky);
  const sand = makeSand(); sand.map.repeat.set(350, 350); sand.normalMap.repeat.set(350, 350);
  scene.add(makeTerrain(std({ map: sand.map, normalMap: sand.normalMap, normalScale: new T.Vector2(1.5, 1.5), roughness: .97, metalness: 0, color: C(0xa3a6c6) }), 16, 1, 9));
  const S_DIR = new T.Vector3(-.66, .53, -.53).normalize(), comet = makeComet(S_DIR.clone().multiplyScalar(105)); scene.add(comet.group);
  const sun = new T.DirectionalLight(C(0xffd9a0), 1.5); sun.position.copy(S_DIR).multiplyScalar(30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 90 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
  const fill = new T.DirectionalLight(C(0x8fa8f0), 2.0); scene.add(fill, fill.target);   // luce fredda che segue la camera
  scene.add(new T.HemisphereLight(C(0x2a3f7a), C(0x3a2a1a), .9));
  const DN = 500, dp = new Float32Array(DN * 3); for (let i = 0; i < DN; i++) { dp[i * 3] = (R() - .5) * 18; dp[i * 3 + 1] = R() * .5; dp[i * 3 + 2] = (R() - .5) * 18; }
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
  const dust = new T.Points(dg, new T.PointsMaterial({ size: .022, color: C(0xb59a74), transparent: true, opacity: .3, depthWrite: false })); scene.add(dust);
  const FACE = Math.atan2(S_DIR.z, -S_DIR.x);   // le statue guardano verso -x: giro quanto serve per puntare la stella
  const LAYOUT = [{ x: -1.2, z: -2.8, s: 2.8, tilt: -.07, yaw: .06 }, { x: 2.3, z: -.4, s: 2.8, tilt: -.06, yaw: -.08 }, { x: -3.4, z: 1.4, s: 3.2, tilt: -.14, yaw: .1 }];   // il GLB è in scala di statuina: lo porto a misura di persona
  const ready = loadGLB('desert', prog('Carico i Re Magi… ')).then(gltf => {
    const root = gltf.scene; root.updateMatrixWorld(true);
    [...root.children].forEach((k, i) => {
      const c = LAYOUT[i] || LAYOUT[0], box = new T.Box3().setFromObject(k), ctr = box.getCenter(new T.Vector3());
      k.position.x -= ctr.x; k.position.y -= box.min.y; k.position.z -= ctr.z;
      k.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; const m = o.material; ['map', 'normalMap', 'metalnessMap', 'aoMap'].forEach(n => { if (m[n]) m[n].anisotropy = aniso(); }); } });
      const tilt = new T.Group(), pivot = new T.Group(); tilt.add(k); pivot.add(tilt); tilt.rotation.z = c.tilt;
      pivot.scale.setScalar(c.s); pivot.rotation.y = FACE + c.yaw; pivot.position.set(c.x, -.035 * c.s, c.z); scene.add(pivot);   // il bordo del basamento resta sotto la sabbia
    });
  });
  return { scene, sky, ready, cam: { az: 1.15, pitch: .2, rad: 9.6, cx: .2, cy: 1.1, cz: .3, h: 1.75, auto: t => ({ az: Math.sin(t * .09) * .09, pitch: Math.sin(t * .07) * .02, h: Math.sin(t * .11) * .04, rad: 0 }) },
    tick(t, dt) { comet.update(t); fill.position.copy(pos).add(new T.Vector3(0, 3, 0)); fill.target.position.set(.2, 1.1, .3);
      const a = dust.geometry.attributes.position; for (let i = 0; i < DN; i++) { let x = a.getX(i) - dt * (.7 + (i % 5) * .15), y = a.getY(i) + Math.sin(t + i) * dt * .06; if (x < -9) x += 18; a.setX(i, x); a.setY(i, y); } a.needsUpdate = true; } };
}

/* =====================  SCENA 2 · Betlemme, la notte della nascita  ===================== */
function buildBethlehem() {
  const scene = new T.Scene(); scene.fog = new T.FogExp2(C(0x1a1c30), .0125);
  const sky = skyFor(); scene.add(sky);
  { const pm = new T.PMREMGenerator(renderer), es = new T.Scene(); es.add(makeSky()); scene.environment = pm.fromScene(es).texture; pm.dispose(); }   // riflessi del cielo notturno
  const earth = makeSand([176, 150, 104], .28); earth.map.repeat.set(260, 260); earth.normalMap.repeat.set(260, 260);
  scene.add(makeTerrain(std({ map: earth.map, normalMap: earth.normalMap, normalScale: new T.Vector2(1.2, 1.2), roughness: 1, color: C(0x9a9cb8) }), 22, 1, 5));
  // la stella, alta dietro la stalla, e il suo fascio di luce che scende sul tetto
  const STAR = new T.Vector3(8, 54, -92), comet = makeComet(STAR, new T.Vector3(.9, -.12, .35)); scene.add(comet.group);
  { const to = new T.Vector3(0, 4.3, -1.5), v = STAR.clone().sub(to), len = v.length(), g = new T.CylinderGeometry(.5, 5, len, 28, 1, true);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: beamTex(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    m.position.copy(to).addScaledVector(v, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()); scene.add(m); }
  // luci: freddo di notte, calore della lanterna e del Bambino
  const fill = new T.DirectionalLight(C(0x7f98e0), 1.5); scene.add(fill, fill.target);
  const rim = new T.DirectionalLight(C(0xbcd0ff), .7); rim.position.set(8, 30, -40); scene.add(rim);
  scene.add(new T.HemisphereLight(C(0x24305a), C(0x2a2018), .6));
  const lant = new T.PointLight(C(0xffb866), 11, 0, 2); lant.position.set(4.4, 2.7, 4); lant.castShadow = true; lant.shadow.mapSize.set(1024, 1024); lant.shadow.bias = -.002; scene.add(lant);
  const babe = new T.PointLight(C(0xffd9a0), 10, 0, 2); babe.position.set(0, 1, .6); scene.add(babe);
  const soft = glowTex([[0, 'rgba(255,236,190,1)'], [.3, 'rgba(255,200,120,.4)'], [1, 'rgba(255,160,70,0)']]);
  const spr = (x, y, z, size, op) => { const s = new T.Sprite(new T.SpriteMaterial({ map: soft, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false })); s.position.set(x, y, z); s.scale.setScalar(size); scene.add(s); return s; };
  const lantGlow = spr(4.4, 2.7, 4, 1.9, .7), babeGlow = spr(0, 1, .6, 1.8, .55);

  // la stalla (legno, pietra e paglia, fatte con texture generate al volo)
  const wood = std({ map: woodTex(), roughness: .9 }), stone = std({ map: stoneTex(), roughness: 1 }), thatch = std({ map: thatchTex(), roughness: 1 });
  const add = (geo, mat, x, y, z, rx, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const tilt = -.114, X = 6, ZB = -7, ZF = 4.4, ZC = (ZB + ZF) / 2;   // larghezza, fondo e fronte della capanna: gli animali stanno dentro
  [[-X, ZF, 4.3], [X, ZF, 4.3], [-X, ZB + .2, 3], [X, ZB + .2, 3]].forEach(([x, z, h]) => add(new T.CylinderGeometry(.15, .18, h, 12), wood, x, h / 2, z));
  add(new T.BoxGeometry(2 * X + .8, .3, 12), thatch, 0, 3.72, ZC, tilt);                // tetto di paglia, in discesa verso il fondo
  for (let x = -X; x <= X + .01; x += 1.2) add(new T.BoxGeometry(.16, .2, 11.6), wood, x, 3.44, ZC, tilt);   // travi
  add(new T.BoxGeometry(2 * X + .6, .26, .26), wood, 0, 4.22, ZF); add(new T.BoxGeometry(2 * X + .6, .26, .26), wood, 0, 3, ZB + .2);
  add(new T.BoxGeometry(2 * X + .8, 3.1, .6), stone, 0, 1.55, ZB - .1);                  // muro di fondo in pietra
  add(new T.BoxGeometry(.3, 3, 6.2), wood, -X - .25, 1.5, ZB + 3.1); add(new T.BoxGeometry(.3, 3, 6.2), wood, X + .25, 1.5, ZB + 3.1);
  [[-4.6, 2.6, .2], [-4.1, 3.4, -.3], [4.7, 2.2, 0], [4.8, 2.3, .1]].forEach(([x, z, r], i) => add(new T.BoxGeometry(1.2, .6, .75), thatch, x, i === 3 ? .9 : .3, z, 0, r));   // balle di paglia
  { const fr = std({ color: C(0x2a2018), roughness: .6, metalness: .6 }), l = add(new T.BoxGeometry(.26, .38, .26), new T.MeshBasicMaterial({ color: 0xffc880, toneMapped: false }), 4.4, 2.7, 4); l.castShadow = false;
    [-.22, .22].forEach(dy => { const c = add(new T.BoxGeometry(.34, .05, .34), fr, 4.4, 2.7 + dy, 4); c.castShadow = false; });
    add(new T.CylinderGeometry(.012, .012, 1.5, 6), std({ color: C(0x222222), metalness: .8 }), 4.4, 3.65, 4); }

  // scintille della lanterna
  const EN = 70, ep = new Float32Array(EN * 3), eph = []; for (let i = 0; i < EN; i++) { ep[i * 3] = 4.4 + (R() - .5) * 6; ep[i * 3 + 1] = R() * 3; ep[i * 3 + 2] = 3 + (R() - .5) * 8; eph.push(R() * 6.28); }
  const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.BufferAttribute(ep, 3));
  const embers = new T.Points(eg, new T.PointsMaterial({ size: .06, map: glowTex([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]), color: C(0xffc070), transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false })); scene.add(embers);

  // la natività del sito (famiglia, paglia, asino) con la mucca animata; senza i Magi, che non sono ancora arrivati
  let mixer = null; const S = 2.2;
  const ready = loadGLB('nat', prog('Carico la natività… ')).then(async gltf => {
    const model = gltf.scene; model.updateMatrixWorld(true);
    [...model.children].forEach(k => { const c = new T.Box3().setFromObject(k).getCenter(new T.Vector3()); if (c.z > 1.5) model.remove(k); });   // via i Magi
    model.scale.setScalar(S); model.updateMatrixWorld(true); const floorY = -new T.Box3().setFromObject(model).min.y;   // il fondo della paglia appoggia a terra
    let babePos = null; model.traverse(o => { if (o.name === 'MVFC3832b_menino_LP1') babePos = o; });
    try { const cg = await loadGLB('cow'), cow = cg.scene; cow.scale.setScalar(.61); cow.position.set(-1.155, -.03, -1.56); cow.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
      let old = null; model.traverse(o => { if (o.isMesh && o.name.startsWith('Line01_aiStandardSurface')) old = o; }); while (old && old.parent && old.parent !== model) old = old.parent; if (old && old.parent === model) model.remove(old);
      model.add(cow); if (cg.animations.length) { mixer = new T.AnimationMixer(cow); mixer.clipAction(cg.animations[0]).play(); } } catch (e) { console.warn('mucca animata non caricata', e); }
    model.position.set(-.04 * S, floorY, -.56 * S);
    model.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; const m = o.material; if (m) { if (m.color && m.color.r + m.color.g + m.color.b < .03) m.color.set(C(0x2e2723)); m.envMapIntensity = 2.2; ['map', 'normalMap'].forEach(n => { if (m[n]) m[n].anisotropy = aniso(); }); } } });
    scene.add(model); model.updateMatrixWorld(true);
    if (babePos) { const w = babePos.getWorldPosition(new T.Vector3()); babe.position.set(w.x, w.y + .5, w.z + .5); babeGlow.position.set(w.x, w.y + .12, w.z + .2); }
  });
  return { scene, sky, ready, cam: { az: .08, pitch: .11, rad: 12.6, cx: 0, cy: 1.2, cz: -.8, h: 1.4, auto: t => ({ az: Math.sin(t * .07) * .13, pitch: Math.sin(t * .05) * .015, h: Math.sin(t * .09) * .05, rad: -Math.sin(t * .045 + 1) * 1.6 }) },
    tick(t, dt) { comet.update(t); if (mixer) mixer.update(dt);
      const f = .9 + .1 * Math.sin(t * 11) * Math.sin(t * 7.3) + .05 * Math.sin(t * 3.1);   // la fiamma della lanterna vacilla
      lant.intensity = 11 * f; lantGlow.material.opacity = .65 * f; babe.intensity = 10 * (1 + .06 * Math.sin(t * 1.4)); babeGlow.material.opacity = .5 + .08 * Math.sin(t * 1.4);
      fill.position.copy(pos).add(new T.Vector3(0, 3, 2)); fill.target.position.set(0, 1, 0);
      const a = embers.geometry.attributes.position; for (let i = 0; i < EN; i++) { let y = a.getY(i) + dt * (.12 + (i % 4) * .05); if (y > 4.5) y = 0; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * .6 + eph[i]) * dt * .08); } a.needsUpdate = true; } };
}

/* ---------- cambio scena con dissolvenza ---------- */
const BUILD = { 1: buildDesert, 2: buildBethlehem }, SC = {}, TXT = {
  1: ['Scena 1 · Nel deserto', 'La stella nel cielo', '«Abbiamo visto spuntare la sua stella e siamo venuti ad adorarlo.» — Matteo 2,2'],
  2: ['Scena 2 · A Betlemme', 'La notte della nascita', 'Maria diede alla luce il suo figlio primogenito, lo avvolse in fasce e lo pose in una mangiatoia. — Luca 2,7'] };
let cur = null, busy = false; const fade = $('#fade');
/* ---------- racconto audio (voce + musica già mixate): parte dopo qualche secondo, non subito ---------- */
const AUDIO = { 1: 'audio/scena1.mp3', 2: 'audio/scena2.mp3' };
const DELAY = { first: 2000, next: 2000 };   // millisecondi di attesa dopo che la scena è comparsa (cambiali qui)
const NARR = { el: null, timer: 0, due: false, muted: false, blocked: false };
const tapHint = $('#tap'), sndBtn = $('#snd');
const narrFade = (a, ms, done) => { const v0 = a.volume, t0 = performance.now(), iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = v0 * (1 - k); if (k >= 1) { clearInterval(iv); a.pause(); if (done) done(); } }, 40); };
function narrStop(ms) { clearTimeout(NARR.timer); NARR.due = false; NARR.blocked = false; if (tapHint) tapHint.classList.remove('on'); const a = NARR.el; NARR.el = null; if (a) narrFade(a, ms || 600, () => { a.removeAttribute('src'); a.load(); }); }
function narrPlay() {
  const a = NARR.el; if (!a || NARR.muted || document.hidden) return;
  const p = a.play(); if (p && p.catch) p.catch(() => { NARR.blocked = true; if (tapHint) tapHint.classList.add('on'); });   // il browser vuole un tocco prima di far partire l'audio
  if (p && p.then) p.then(() => { NARR.blocked = false; if (tapHint) tapHint.classList.remove('on'); });
}
function narrStart(n, wait) {
  narrStop(0); if (!AUDIO[n]) return;
  const a = new Audio(AUDIO[n]); a.preload = 'auto'; a.volume = 1; NARR.el = a;
  NARR.timer = setTimeout(() => { NARR.due = true; narrPlay(); }, wait);
}
['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => addEventListener(ev, e => { if (NARR.blocked && NARR.due && !(e.target.closest && e.target.closest('#snd'))) narrPlay(); }, true));
document.addEventListener('visibilitychange', () => { const a = NARR.el; if (!a) return; if (document.hidden) a.pause(); else if (NARR.due) narrPlay(); });
if (sndBtn) sndBtn.addEventListener('click', () => {
  NARR.muted = !NARR.muted; sndBtn.textContent = NARR.muted ? '🔇 Audio' : '🔊 Audio'; sndBtn.classList.toggle('on', NARR.muted);
  if (NARR.muted) { if (NARR.el) NARR.el.pause(); if (tapHint) tapHint.classList.remove('on'); } else if (NARR.due) narrPlay();
});

/* ---------- VR: sul visore si entra direttamente nella scena (niente anteprima) ---------- */
const VR = { on: false, session: null, yOff: 0, fade: 1, fadeTo: 1, capUntil: 0, rig: new T.Group() };   // rig = "pedana" su cui sta la persona
const NEAR = { 1: .7, 2: .6 };   // dove parte la persona rispetto all'anteprima (1 = stessa distanza, più basso = più vicino alla scena)
const vrFadeMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1, side: T.BackSide, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
const vrFadeMesh = new T.Mesh(new T.SphereGeometry(.4, 16, 12), vrFadeMat); vrFadeMesh.renderOrder = 9999; vrFadeMesh.frustumCulled = false;   // sfera nera attorno alla testa: la dissolvenza nel visore
const capCv = document.createElement('canvas'); capCv.width = 1024; capCv.height = 256;
const capTex = srgb(new T.CanvasTexture(capCv)), capMat = new T.MeshBasicMaterial({ map: capTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
const capMesh = new T.Mesh(new T.PlaneGeometry(.9, .225), capMat); capMesh.position.set(0, -.3, -1.2); capMesh.renderOrder = 9998; capMesh.frustumCulled = false;
const ctlMat = new T.MeshBasicMaterial({ color: 0xf2c14e, fog: false });
for (let i = 0; i < 2; i++) { const c = renderer.xr.getController(i); c.add(new T.Mesh(new T.SphereGeometry(.02, 12, 8), ctlMat)); c.addEventListener('select', () => vrToggle()); c.addEventListener('squeeze', () => vrToggle()); VR.rig.add(c); }
const vrgo = $('#vrgo'), vrnav = $('#vrnav');
function vrToggle() { if (VR.on && cur && !busy) show(cur.n === 1 ? 2 : 1); }   // grilletto o grip: cambia scena
function vrCaption(n, hint) {
  const g = capCv.getContext('2d'); g.clearRect(0, 0, 1024, 256); g.fillStyle = 'rgba(8,14,32,.62)'; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, 1024, 256, 36); else g.rect(0, 0, 1024, 256); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#f2c14e'; g.font = '28px Georgia,serif'; g.fillText(TXT[n][0].toUpperCase(), 512, 70);
  g.fillStyle = '#f6ecd6'; g.font = '600 58px Georgia,serif'; g.fillText(TXT[n][1], 512, 145);
  if (hint) { g.globalAlpha = .85; g.font = 'italic 28px Georgia,serif'; g.fillText('Grilletto: cambia scena', 512, 207); g.globalAlpha = 1; }
  capTex.needsUpdate = true; VR.capUntil = performance.now() + 9000;
}
function placeRig() {   // mette la persona nel punto di partenza della scena, rivolta verso il centro
  const c = cur.cam, rad = c.rad * (NEAR[cur.n] || 1), px = c.cx + Math.sin(c.az) * rad, pz = c.cz + Math.cos(c.az) * rad;
  VR.rig.position.set(px, VR.yOff, pz); VR.rig.rotation.set(0, Math.atan2(-(c.cx - px), -(c.cz - pz)), 0);
  cur.scene.add(VR.rig); if (camera.parent !== VR.rig) VR.rig.add(camera);
  if (vrFadeMesh.parent !== camera) camera.add(vrFadeMesh, capMesh);
}
/* carica prima di entrare: shader compilati e texture già sulla GPU, così nel visore non ci sono scatti al primo sguardo */
function prewarm(S) {
  try { S.scene.traverse(o => { const m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach(mm => { for (const k in mm) { const v = mm[k]; if (v && v.isTexture) renderer.initTexture(v); } }); }); renderer.compile(S.scene, camera); } catch (e) { console.warn('prewarm', e); }
}
async function enterVR() {
  if (!navigator.xr || VR.on) return;
  if (vrgo) vrgo.disabled = true;
  let s; try { s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); } catch (e) { console.warn(e); if (vrgo) { vrgo.disabled = false; vrgo.textContent = 'Non riesco ad avviare il VR · riprova'; } return; }
  const ef = s.enabledFeatures, floor = !ef || ef.includes('local-floor');
  renderer.xr.setReferenceSpaceType(floor ? 'local-floor' : 'local'); VR.yOff = floor ? 0 : 1.6;   // senza pavimento: alzo la pedana all'altezza degli occhi
  renderer.xr.setFramebufferScaleFactor(XR_SCALE); renderer.xr.setFoveation(1);   // foveation: il visore sfuoca i bordi, meno lavoro per la GPU
  await renderer.xr.setSession(s);
  VR.on = true; VR.session = s; VR.fade = 1; VR.fadeTo = 0; document.body.classList.add('invr');
  placeRig(); renderer.shadowMap.needsUpdate = true; vrCaption(cur.n, true); narrStart(cur.n, 3500);
  s.addEventListener('visibilitychange', () => { const a = NARR.el; if (!a) return; if (s.visibilityState === 'hidden') a.pause(); else if (NARR.due) narrPlay(); });   // visore tolto: l'audio si ferma
  s.addEventListener('end', () => {
    VR.on = false; VR.session = null; narrStop(300); VR.rig.remove(camera); VR.rig.removeFromParent(); vrFadeMesh.visible = false; capMat.opacity = 0; document.body.classList.remove('invr');
    if (vrgo) { vrgo.disabled = false; vrgo.textContent = 'Rientra in VR'; } dispatchEvent(new Event('resize'));
  }, { once: true });
}
if (vrgo) vrgo.addEventListener('click', enterVR); if (vrnav) vrnav.addEventListener('click', enterVR);

async function show(n, first) {
  if (busy || (cur && cur.n === n)) return; busy = true;
  if (!first) { if (VR.on) VR.fadeTo = 1; narrStop(900); fade.style.transition = 'opacity .9s ease'; fade.style.opacity = 1; await new Promise(r => setTimeout(r, 950)); }
  if (!SC[n]) { SC[n] = BUILD[n](); SC[n].n = n; }
  document.body.classList.remove('ready'); if (status) { status.style.display = ''; status.textContent = 'Carico la scena…'; }
  try { await SC[n].ready; } catch (e) { console.error(e); if (status) status.textContent = 'Non riesco a caricare la scena.'; fade.style.opacity = ''; busy = false; return; }
  if (LOW) prewarm(SC[n]);
  cur = SC[n]; D.az = D.pitch = D.rad = 0;
  if (VR.on) { placeRig(); vrCaption(n, false); }
  renderer.shadowMap.needsUpdate = true; setTimeout(() => { renderer.shadowMap.needsUpdate = true; }, 2500);   // ombre ricalcolate una volta (poi restano ferme)
  const cap = $('.cap'); if (cap) { cap.querySelector('small').textContent = TXT[n][0]; cap.querySelector('h1').textContent = TXT[n][1]; cap.querySelector('p').textContent = TXT[n][2]; }
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('on', +b.dataset.scene === n));
  if (status) status.style.display = 'none';
  fade.style.transition = first ? 'opacity 3.2s ease .2s' : 'opacity 1.6s ease'; document.body.classList.add('ready'); fade.style.opacity = ''; window.__storiaReady = true; busy = false;
  VR.fadeTo = 0; if (VR.on || !VRMODE) narrStart(n, first ? DELAY.first : DELAY.next);   // sul visore l'audio parte quando si entra in VR
}
document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => show(+b.dataset.scene)));
(async () => {
  let sup = false; try { sup = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) {}
  VRMODE = sup && (HEADSET || QS.has('vr')) && !QS.has('preview');   // ?preview forza l'anteprima anche sul visore
  if (VRMODE) document.body.classList.add('vrmode'); else if (sup && vrnav) vrnav.hidden = false;   // PC con visore collegato: anteprima + bottone VR
  const first = window.START_SCENE || +QS.get('s') || 1;
  await show(first, true);
  if (!VRMODE) return;
  if (!cur) { if (vrgo) vrgo.textContent = 'Non riesco a caricare la storia'; return; }
  try { const o = first === 2 ? 1 : 2; if (!SC[o]) { SC[o] = BUILD[o](); SC[o].n = o; } await SC[o].ready; prewarm(SC[o]); } catch (e) { console.warn('seconda scena', e); }   // prepara anche l'altra scena ora, così il cambio nel visore è immediato
  if (vrgo) { vrgo.disabled = false; vrgo.textContent = 'Entra in VR'; }
})();

let last = performance.now(), t = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt; if (!cur) return;
  if (VRMODE && !VR.on) return;   // sul visore, prima di entrare in VR non disegno niente
  if (VR.on) {   // nel visore la testa muove la camera: qui si aggiornano solo animazioni, dissolvenza e cielo
    const d = VR.fadeTo - VR.fade; VR.fade += Math.sign(d) * Math.min(Math.abs(d), dt / .6); vrFadeMat.opacity = VR.fade; vrFadeMesh.visible = VR.fade > .004;
    capMat.opacity = Math.min(1, Math.max(0, (VR.capUntil - performance.now()) / 1500)) * (1 - VR.fade);
    pos.set(VR.rig.position.x, 1.6, VR.rig.position.z); cur.sky.position.copy(VR.rig.position); cur.sky.material.uniforms.t.value = t; cur.tick(t, dt);
    renderer.render(cur.scene, camera); return;
  }
  const c = cur.cam, a = c.auto(t), az = c.az + D.az + a.az, pitch = c.pitch + D.pitch + a.pitch, rad = c.rad + D.rad + a.rad;
  pos.set(c.cx + Math.sin(az) * rad, c.h + a.h, c.cz + Math.cos(az) * rad);
  dir.set(c.cx - pos.x, 0, c.cz - pos.z).normalize().multiplyScalar(Math.cos(pitch)); dir.y = Math.sin(pitch);
  camera.position.copy(pos); camera.lookAt(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
  cur.sky.position.copy(pos); cur.sky.material.uniforms.t.value = t; cur.tick(t, dt);
  renderer.render(cur.scene, camera);
});
})();
