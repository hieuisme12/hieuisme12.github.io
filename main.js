import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

/* ---------------- language ---------------- */
const root = document.documentElement;
function store(k, v) { try { v === undefined ? (v = localStorage.getItem(k)) : localStorage.setItem(k, v); return v; } catch { return null; } }
function setLang(lang) {
  root.dataset.lang = lang;
  root.lang = lang;
  document.querySelectorAll('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
  store('lang', lang);
  updateReadout();
}
document.querySelectorAll('[data-set-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.setLang)));

/* ---------------- city model ---------------- */
const N = 21;                 // grid cells per side
const HALF = (N - 1) / 2;
const isStreet = (i, j) => i % 4 === 0 || j % 4 === 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A river runs across the middle of the district (rows 9-11). Streets cross it on bridges of
// different heights, so as the water rises the bridges go under one by one and the route detours.
const BRIDGE = { 0: 0.45, 4: 0.30, 8: 0.14, 12: 0.22, 16: 0.38, 20: 0.52 };
const isRiver = (i, j) => j >= 9 && j <= 11;
const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / r);
function elev(i, j) {
  if (isRiver(i, j)) return isStreet(i, j) ? BRIDGE[i] : 0.04;
  const x = i - HALF, z = j - HALF;
  let g = 0.66 + 0.05 * Math.sin(i * 0.7) * Math.cos(j * 0.9);
  g -= 0.22 * gauss(x, z, -6, -6, 4) + 0.26 * gauss(x, z, 6, 6, 4);   // two low neighbourhoods
  if (j === 8 || j === 12) g = Math.min(g, 0.6);                      // riverside roads
  return clamp(g, 0.04, 0.95);
}
// deterministic pseudo-random so the skyline is the same on every visit
let seed = 12;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const G = [];
for (let i = 0; i < N; i++) { G[i] = []; for (let j = 0; j < N; j++) G[i][j] = elev(i, j); }

const START = [8, 0], GOAL = [12, N - 1];
const SENSORS = [[0, 10], [4, 10], [8, 10], [12, 10], [16, 10], [20, 10], [4, 4], [16, 16]];

/* ---------------- A* on the street grid ---------------- */
function aStar(level) {
  const key = (i, j) => i * N + j;
  const open = [[...START]];
  const gScore = new Map([[key(...START), 0]]);
  const came = new Map();
  const h = (i, j) => Math.abs(GOAL[0] - i) + Math.abs(GOAL[1] - j);
  const fScore = new Map([[key(...START), h(...START)]]);
  const passable = (i, j) => i >= 0 && j >= 0 && i < N && j < N && isStreet(i, j) && G[i][j] > level;
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (fScore.get(key(...open[k])) < fScore.get(key(...open[bi]))) bi = k;
    const [ci, cj] = open.splice(bi, 1)[0];
    if (ci === GOAL[0] && cj === GOAL[1]) {
      const path = [[ci, cj]];
      let k = key(ci, cj);
      while (came.has(k)) { k = came.get(k); path.unshift([Math.floor(k / N), k % N]); }
      return path;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di, nj = cj + dj;
      if (!passable(ni, nj)) continue;
      const margin = G[ni][nj] - level;            // close to the waterline costs more
      const cost = 1 + (margin < 0.04 ? 1 : 0);
      const t = gScore.get(key(ci, cj)) + cost;
      const nk = key(ni, nj);
      if (t < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, key(ci, cj));
        gScore.set(nk, t);
        fScore.set(nk, t + h(ni, nj));
        if (!open.some(([a, b]) => a === ni && b === nj)) open.push([ni, nj]);
      }
    }
  }
  return null;
}

/* ---------------- three.js scene ---------------- */
const canvas = document.getElementById('city');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch {
  canvas.remove();
}

const C = { mist: 0xE6ECF0, paper: 0xF7F9FA, street: 0xCFD9E1, lot: 0xEEF2F5, ink: 0x13293D, water: 0x2B7DB8, route: 0xF08A24, alert: 0xD6453D, park: 0xBFD3C6, riverbed: 0x8FA9BE };

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(C.mist, 55, 95);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
const city = new THREE.Group();
scene.add(city);

scene.add(new THREE.HemisphereLight(0xffffff, 0xB8C6D2, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0008;
scene.add(sun);

const box = new THREE.BoxGeometry(1, 1, 1);
const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
const tiles = new THREE.InstancedMesh(box, tileMat, N * N);
tiles.receiveShadow = true;

const lots = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!isStreet(i, j) && !isRiver(i, j)) lots.push([i, j]);
const bldMat = new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.7 });
const buildings = new THREE.InstancedMesh(box, bldMat, lots.length);
buildings.castShadow = buildings.receiveShadow = true;

const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
let t = 0, b = 0;
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const g = G[i][j];
  s.set(1, g, 1); p.set(i - HALF, g / 2, j - HALF);
  m.compose(p, q, s); tiles.setMatrixAt(t, m);
  tiles.setColorAt(t++, col.set(isRiver(i, j) && !isStreet(i, j) ? C.riverbed : isStreet(i, j) ? C.street : C.lot));
  if (!isStreet(i, j) && !isRiver(i, j)) {
    const park = rand() < 0.12;
    const hgt = park ? 0.06 : 0.25 + rand() ** 1.7 * 2.6;
    const w = park ? 0.9 : 0.62 + rand() * 0.22;
    s.set(w, hgt, park ? 0.9 : 0.62 + rand() * 0.22);
    p.set(i - HALF, g + hgt / 2, j - HALF);
    m.compose(p, q, s); buildings.setMatrixAt(b, m);
    buildings.setColorAt(b++, col.set(park ? C.park : (rand() < 0.15 ? 0xDDE6EE : C.paper)));
  }
}
city.add(tiles, buildings);

// water
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(N, N),
  new THREE.MeshStandardMaterial({ color: C.water, transparent: true, opacity: 0.7, roughness: 0.15, metalness: 0.1 })
);
water.rotation.x = -Math.PI / 2;
city.add(water);

// base slab so the model reads as an object
const slab = new THREE.Mesh(new THREE.BoxGeometry(N + 0.4, 0.5, N + 0.4), new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.8 }));
slab.position.y = -0.25;
city.add(slab);

// sensors
const sensorGeo = new THREE.SphereGeometry(0.17, 20, 14);
const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8);
const poleMat = new THREE.MeshStandardMaterial({ color: C.ink });
const ringGeo = new THREE.RingGeometry(0.25, 0.32, 40);
const sensors = SENSORS.map(([i, j]) => {
  const g = G[i][j];
  const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(i - HALF, g + 0.45, j - HALF);
  const mat = new THREE.MeshStandardMaterial({ color: C.ink, emissive: 0x000000 });
  const head = new THREE.Mesh(sensorGeo, mat); head.position.set(i - HALF, g + 0.95, j - HALF);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: C.alert, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(i - HALF, 0, j - HALF);
  city.add(pole, head, ring);
  return { g, mat, ring, flooded: false };
});

// start / goal markers
function pin(i, j, color) {
  const g = G[i][j];
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 32), new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(i - HALF, g + 0.08, j - HALF);
  city.add(mesh);
}
pin(...START, C.ink); pin(...GOAL, C.route);

// route
const routeMat = new THREE.MeshStandardMaterial({ color: C.route, emissive: C.route, emissiveIntensity: 0.45, roughness: 0.4 });
let routeMesh = null, routePts = [];
const car = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshStandardMaterial({ color: C.ink, emissive: C.route, emissiveIntensity: 0.25 }));
city.add(car);

let currentPath = null;
function buildRoute(path) {
  if (routeMesh) { city.remove(routeMesh); routeMesh.geometry.dispose(); routeMesh = null; }
  currentPath = path;
  car.visible = !!path;
  if (!path) { routePts = []; return; }
  // simplify to corners so the tube has crisp turns
  const pts = [path[0]];
  for (let k = 1; k < path.length - 1; k++) {
    const [a, b2] = [path[k - 1], path[k + 1]];
    if (a[0] !== b2[0] && a[1] !== b2[1]) pts.push(path[k]);
  }
  pts.push(path[path.length - 1]);
  const y = (i, j) => G[i][j] + 0.1;
  routePts = path.map(([i, j]) => new THREE.Vector3(i - HALF, y(i, j), j - HALF));
  const curve = new THREE.CurvePath();
  for (let k = 0; k < routePts.length - 1; k++) curve.add(new THREE.LineCurve3(routePts[k], routePts[k + 1]));
  routeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, routePts.length * 3, 0.08, 10, false), routeMat);
  routeMesh.castShadow = true;
  city.add(routeMesh);
}

/* ---------------- state + UI ---------------- */
const slider = document.getElementById('level');
const rLevel = document.getElementById('r-level');
const rSensors = document.getElementById('r-sensors');
const rRoute = document.getElementById('r-route');
const levelFromSlider = v => 0.08 + (v / 100) * 0.5;

let level = levelFromSlider(+slider.value), lastQuant = -1, userTouched = false;

function updateReadout() {
  const v = +slider.value;
  rLevel.textContent = `${(v / 100).toFixed(2)} m`;
  const flooded = sensors.filter(x => x.flooded).length;
  rSensors.textContent = `${flooded} / ${sensors.length}`;
  const vi = root.dataset.lang === 'vi';
  if (currentPath) {
    rRoute.textContent = vi ? `${currentPath.length - 1} ô phố` : `${currentPath.length - 1} blocks`;
    rRoute.classList.remove('blocked');
  } else {
    rRoute.textContent = vi ? 'Không có, chờ nước rút' : 'None, wait it out';
    rRoute.classList.add('blocked');
  }
}

function applyLevel() {
  water.position.y = level;
  const quant = Math.round(level * 200);
  if (quant !== lastQuant) {
    lastQuant = quant;
    sensors.forEach(sn => {
      sn.flooded = level > sn.g;
      sn.mat.color.set(sn.flooded ? C.alert : C.ink);
      sn.mat.emissive.set(sn.flooded ? C.alert : 0x000000);
      sn.mat.emissiveIntensity = sn.flooded ? 0.5 : 0;
      sn.ring.position.y = level + 0.01;
    });
    const path = aStar(level);
    const same = path && currentPath && path.length === currentPath.length && path.every((pt, k) => pt[0] === currentPath[k][0] && pt[1] === currentPath[k][1]);
    if (!same) buildRoute(path);
    updateReadout();
  }
}
slider.addEventListener('input', () => { userTouched = true; level = levelFromSlider(+slider.value); applyLevel(); });

/* ---------------- camera, drag, resize ---------------- */
let azimuth = Math.PI * 0.25, targetAz = azimuth, elevAngle = 0.68, dist = 40;
let dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!dragging) return; targetAz -= (e.clientX - lastX) * 0.006; lastX = e.clientX; });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

function placeCamera() {
  camera.position.set(Math.cos(azimuth) * Math.cos(elevAngle) * dist, Math.sin(elevAngle) * dist, Math.sin(azimuth) * Math.cos(elevAngle) * dist);
  camera.lookAt(0, 0.6, 0);
}

function resize() {
  if (!renderer) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (w > 860) {
    dist = 50;
    camera.setViewOffset(w, h, -w * 0.24, h * 0.03, w, h);   // push the city to the right of the headline
  } else {
    dist = 78;
    camera.setViewOffset(w, h, 0, -h * 0.25, w, h);           // push it below the headline on phones
  }
  scene.fog.near = dist + 6; scene.fog.far = dist + 50;
  camera.updateProjectionMatrix();
}

/* ---------------- loop ---------------- */
let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(canvas);

const clock = new THREE.Clock();
let carT = 0;
function frame() {
  requestAnimationFrame(frame);
  if (!visible || document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;

  if (!userTouched && !reduceMotion) {
    const v = 48 + 44 * Math.sin(time * 0.28 - 1.2);           // tide rises and falls on its own
    slider.value = String(Math.round(v));
    level = levelFromSlider(v);
    applyLevel();
  }
  if (!dragging && !reduceMotion) targetAz += dt * 0.04;
  azimuth += (targetAz - azimuth) * 0.08;
  placeCamera();

  water.position.y = level + (reduceMotion ? 0 : Math.sin(time * 1.4) * 0.008);
  sensors.forEach(sn => {
    if (!sn.flooded || reduceMotion) { sn.ring.material.opacity = sn.flooded ? 0.6 : 0; sn.ring.scale.setScalar(1); return; }
    const k = (time * 0.8 + sn.g * 7) % 1;
    sn.ring.scale.setScalar(1 + k * 2.4);
    sn.ring.material.opacity = 0.7 * (1 - k);
  });

  if (routePts.length > 1) {
    carT = reduceMotion ? 0.5 : (carT + dt * 0.06) % 1;
    const f = carT * (routePts.length - 1), k = Math.floor(f);
    car.position.lerpVectors(routePts[k], routePts[Math.min(k + 1, routePts.length - 1)], f - k);
    car.position.y += 0.12;
  }
  renderer.render(scene, camera);
}

if (renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  addEventListener('resize', resize);
  resize();
  applyLevel();
  placeCamera();
  frame();
}

const saved = store('lang');
setLang(saved === 'vi' || saved === 'en' ? saved : ((navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en'));
