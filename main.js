import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

/* ================= language ================= */
const root = document.documentElement;
function store(k, v) { try { v === undefined ? (v = localStorage.getItem(k)) : localStorage.setItem(k, v); return v; } catch { return null; } }
const T = {
  en: { none: 'No safe route', same: 'Pick two different places' },
  vi: { none: 'Không có tuyến an toàn', same: 'Chọn hai điểm khác nhau' },
};
const t = k => T[root.dataset.lang === 'vi' ? 'vi' : 'en'][k];
function setLang(lang) {
  root.dataset.lang = lang;
  root.lang = lang;
  document.querySelectorAll('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
  store('lang', lang);
  if (selFrom) { fillSelects(); startLabel.el.textContent = placeName(start); goalLabel.el.textContent = placeName(goal); startLabel.w = goalLabel.w = 0; }
  refreshPanel();
}
document.querySelectorAll('[data-set-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.setLang)));

/* ================= map model: central Ho Chi Minh City (schematic) =================
   Hand-placed approximations of real streets, rivers and canals. Not to scale, not survey data.
   `flood` is the scenario threshold in cm: a street starts to flood when the water level passes it.
   Flooded streets follow lists published by the HCMC Department of Construction. */
const P = {
  BT: [10.7725, 106.6980], NT: [10.7798, 106.6990], OP: [10.7768, 106.7032], HN: [10.7712, 106.7006],
  WH: [10.7728, 106.7062], TN: [10.7697, 106.7072], KH: [10.7700, 106.7048], CA: [10.7680, 106.7000],
  DL: [10.7772, 106.6955], LD: [10.7826, 106.7020], BS: [10.7862, 106.7058], HB: [10.7822, 106.6986],
  E: [10.7893, 106.6925], F: [10.7912, 106.6972], G: [10.8015, 106.7110], L: [10.8060, 106.7135],
  M: [10.8045, 106.7195], K: [10.7950, 106.7208], H: [10.7985, 106.7215], I: [10.8008, 106.7282],
  J: [10.8035, 106.7335], TD: [10.8052, 106.7368], AP: [10.8030, 106.7480], TE: [10.7728, 106.7178],
  BTM: [10.8035, 106.6985], TT: [10.7560, 106.7210], Q7: [10.7390, 106.7292], TDI: [10.7918, 106.6893],
};
const ROADS = [
  { n: 'Nguyễn Hữu Cảnh', c: 1, p: ['BS', [10.7892, 106.7098], [10.7925, 106.7158], 'K', 'H'], flood: 0 },
  { n: 'Điện Biên Phủ', c: 1, p: [[10.7832, 106.6790], [10.7865, 106.6865], 'E', 'F'] },
  { n: 'Điện Biên Phủ', c: 1, p: ['F', [10.7962, 106.7035], 'G', [10.8003, 106.7165], 'H'], flood: 14 },
  { n: 'Ung Văn Khiêm', c: 0, p: ['L', [10.8052, 106.7168], 'M', [10.8072, 106.7238]], flood: 4 },
  { n: 'Đinh Bộ Lĩnh', c: 0, p: ['G', 'L', [10.8150, 106.7165]], flood: 6 },
  { n: 'Xô Viết Nghệ Tĩnh', c: 1, p: ['G', [10.8100, 106.7115], [10.8185, 106.7135]], flood: 10 },
  { n: 'Bạch Đằng', c: 0, p: ['BTM', [10.8030, 106.7050], 'G'], flood: 8 },
  { n: 'Đinh Tiên Hoàng', c: 0, p: ['LD', 'F', 'BTM'] },
  { n: 'Phan Đăng Lưu', c: 0, p: ['BTM', [10.8020, 106.6900], [10.8005, 106.6790]], flood: 16 },
  { n: 'Lê Duẩn', c: 1, p: ['DL', 'NT', 'LD', 'BS'] },
  { n: 'Đồng Khởi', c: 0, p: ['NT', 'OP', 'WH'] },
  { n: 'Lê Lợi', c: 0, p: ['BT', 'OP'] },
  { n: 'Hàm Nghi', c: 0, p: ['BT', 'HN', 'WH'] },
  { n: 'Tôn Đức Thắng', c: 1, p: ['TN', 'WH', 'BS'] },
  { n: 'Hai Bà Trưng', c: 0, p: ['OP', 'HB', 'E', 'TDI'] },
  { n: 'Nam Kỳ Khởi Nghĩa', c: 0, p: ['HN', 'DL', [10.7850, 106.6880], [10.7905, 106.6828]] },
  { n: 'Cách Mạng Tháng Tám', c: 1, p: ['BT', [10.7790, 106.6880], [10.7860, 106.6780], [10.7905, 106.6722]] },
  { n: 'Võ Văn Kiệt', c: 1, p: ['TN', 'KH', 'CA', [10.7642, 106.6920], [10.7588, 106.6800], [10.7560, 106.6718]] },
  { n: 'Calmette', c: 0, p: ['HN', 'CA'], flood: 12 },
  { n: 'Hầm Thủ Thiêm', c: 1, p: ['TN', 'TE'], tunnel: true },
  { n: 'Mai Chí Thọ', c: 1, p: ['TE', [10.7790, 106.7300], [10.7905, 106.7400], 'AP'], flood: 22 },
  { n: 'Cầu Sài Gòn', c: 1, p: ['H', 'I'], bridge: true },
  { n: 'Võ Nguyên Giáp', c: 1, p: ['I', 'J', [10.8040, 106.7420], 'AP', [10.8085, 106.7545]], flood: 30 },
  { n: 'Xuân Thủy', c: 0, p: ['J', 'TD'] },
  { n: 'Nguyễn Văn Hưởng', c: 0, p: ['TD', [10.8120, 106.7372], [10.8185, 106.7365]], flood: 18 },
  { n: 'Nguyễn Gia Trí', c: 0, p: ['M', 'K'], flood: 12 },
  { n: 'Nguyễn Tất Thành', c: 1, p: ['KH', [10.7650, 106.7078], [10.7600, 106.7150], 'TT'] },
  { n: 'Tôn Thất Thuyết', c: 0, p: [[10.7542, 106.6960], [10.7552, 106.7080], [10.7560, 106.7175], 'TT'], flood: 6 },
  { n: 'Huỳnh Tấn Phát', c: 1, p: ['TT', [10.7482, 106.7262], 'Q7', [10.7318, 106.7300]], flood: 4 },
  { n: 'Nguyễn Thị Thập', c: 1, p: [[10.7396, 106.6990], [10.7392, 106.7150], 'Q7'], flood: 10 },
];
const WATER = [
  { w: 1.45, p: [[10.8262, 106.7212], [10.8165, 106.7262], [10.8072, 106.7292], [10.8000, 106.7252], [10.7955, 106.7232], [10.7908, 106.7168], [10.7858, 106.7108], [10.7800, 106.7090], [10.7722, 106.7098], [10.7668, 106.7118], [10.7610, 106.7168], [10.7556, 106.7242], [10.7482, 106.7330], [10.7442, 106.7402], [10.7448, 106.7482], [10.7502, 106.7560]] },
  { w: 0.36, p: [[10.7952, 106.6700], [10.7940, 106.6820], [10.7930, 106.6930], [10.7944, 106.6990], [10.7920, 106.7045], [10.7880, 106.7082], [10.7862, 106.7104]] },
  { w: 0.5, p: [[10.7684, 106.7108], [10.7666, 106.7020], [10.7632, 106.6915], [10.7576, 106.6790], [10.7546, 106.6705]] },
  { w: 0.5, p: [[10.7566, 106.7232], [10.7534, 106.7120], [10.7524, 106.7000], [10.7530, 106.6880], [10.7546, 106.6765]] },
];
// places a visitor can pick as origin or destination (all are routing-graph nodes)
const PLACES = {
  BT: ['Chợ Bến Thành', 'Ben Thanh Market'], NT: ['Nhà thờ Đức Bà', 'Notre-Dame Cathedral'], DL: ['Dinh Độc Lập', 'Independence Palace'],
  OP: ['Nhà hát Thành phố', 'Saigon Opera House'], TDI: ['Tân Định', 'Tan Dinh'], BS: ['Ba Son', 'Ba Son'],
  K: ['Landmark 81', 'Landmark 81'], G: ['Ngã tư Hàng Xanh', 'Hang Xanh junction'], BTM: ['Chợ Bà Chiểu', 'Ba Chieu Market'],
  TD: ['Thảo Điền', 'Thao Dien'], AP: ['An Phú', 'An Phu'], TE: ['Thủ Thiêm', 'Thu Thiem'],
  TT: ['Cầu Tân Thuận', 'Tan Thuan Bridge'], Q7: ['Quận 7', 'District 7'],
};
const placeName = k => PLACES[k][root.dataset.lang === 'vi' ? 0 : 1];
let start = 'BT', goal = 'TD';
const BLOCK_AT = 15;               // cm of water on a street at which the router treats it as impassable
const LEVELS = [                   // FloodSight's 5-step scale
  { cm: 10, c: 0x4CAF50 }, { cm: 20, c: 0x8BC34A }, { cm: 30, c: 0xFFC107 }, { cm: 40, c: 0xFF9800 }, { cm: Infinity, c: 0xF44336 },
];
const levelOf = d => LEVELS.findIndex(l => d < l.cm);

/* projection: 1 unit = 250 m, centred on Ba Son / Thủ Thiêm */
const LAT0 = 10.778, LON0 = 106.712, KX = 109400 / 250, KZ = 110600 / 250;
const proj = ([lat, lon]) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const MAP = { x0: (106.668 - LON0) * KX, x1: (106.757 - LON0) * KX, z0: -(10.827 - LAT0) * KZ, z1: -(10.728 - LAT0) * KZ };

/* ================= routing graph ================= */
const nodeKey = pt => typeof pt === 'string' ? pt : pt.join(',');
const nodePos = new Map();
const adj = new Map();
ROADS.forEach((r, ri) => {
  r.xz = r.p.map(pt => proj(typeof pt === 'string' ? P[pt] : pt));
  r.len = 0;
  for (let k = 0; k < r.p.length; k++) {
    const key = nodeKey(r.p[k]);
    nodePos.set(key, r.xz[k]);
    if (!adj.has(key)) adj.set(key, []);
    if (k) {
      const a = nodeKey(r.p[k - 1]), [x0, z0] = r.xz[k - 1], [x1, z1] = r.xz[k];
      const len = Math.hypot(x1 - x0, z1 - z0);
      r.len += len;
      adj.get(a).push({ to: key, len, ri });
      adj.get(key).push({ to: a, len, ri });
    }
  }
});
const depthOf = (r, water) => (r.flood == null ? 0 : Math.max(0, water - r.flood));

function route(water) {
  if (start === goal) return null;
  const [gx, gz] = nodePos.get(goal);
  const h = k => { const [x, z] = nodePos.get(k); return Math.hypot(gx - x, gz - z); };
  const g = new Map([[start, 0]]), came = new Map(), open = new Set([start]), f = new Map([[start, h(start)]]);
  while (open.size) {
    let cur = null;
    for (const k of open) if (cur === null || f.get(k) < f.get(cur)) cur = k;
    if (cur === goal) {
      const path = [{ key: cur }];
      for (let k = cur; came.has(k);) { const c = came.get(k); path[0].ri = c.ri; path.unshift({ key: c.from }); k = c.from; }
      return path;                                   // each step after the first carries the street it arrived on
    }
    open.delete(cur);
    for (const e of adj.get(cur)) {
      const d = depthOf(ROADS[e.ri], water);
      if (d >= BLOCK_AT) continue;
      const cost = g.get(cur) + e.len * (1 + d / 10);     // shallow water is allowed but penalised
      if (cost < (g.get(e.to) ?? Infinity)) {
        came.set(e.to, { from: cur, ri: e.ri });
        g.set(e.to, cost); f.set(e.to, cost + h(e.to)); open.add(e.to);
      }
    }
  }
  return null;
}

/* ================= scene ================= */
const canvas = document.getElementById('city');
const labelLayer = document.getElementById('labels');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { canvas.remove(); }

const C = { plate: 0xF3F6F8, edge: 0x13293D, grid: 0xD5DEE5, road: 0xA9B8C4, major: 0x7F93A3, water: 0x2B7DB8, canal: 0x4B93C6, bld: 0xFFFFFF, bld2: 0xE4EBF0, tower: 0xC9D5DE, route: 0xF08A24, ink: 0x13293D };

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xE6ECF0, 80, 160);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
const city = new THREE.Group();
scene.add(city);
scene.add(new THREE.HemisphereLight(0xffffff, 0xB8C6D2, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(-18, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
scene.add(sun);

// base plate with a 1 km grid, like a survey sheet
const W = MAP.x1 - MAP.x0, D = MAP.z1 - MAP.z0, CX = (MAP.x0 + MAP.x1) / 2, CZ = (MAP.z0 + MAP.z1) / 2;
const plate = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, D), [
  new THREE.MeshStandardMaterial({ color: C.edge }), new THREE.MeshStandardMaterial({ color: C.edge }),
  new THREE.MeshStandardMaterial({ color: C.plate, roughness: 1 }), new THREE.MeshStandardMaterial({ color: C.edge }),
  new THREE.MeshStandardMaterial({ color: C.edge }), new THREE.MeshStandardMaterial({ color: C.edge }),
]);
plate.position.set(CX, -0.4, CZ);
plate.receiveShadow = true;
city.add(plate);
{
  const v = [];
  for (let x = Math.ceil(MAP.x0 / 4) * 4; x <= MAP.x1; x += 4) v.push(x, 0.005, MAP.z0, x, 0.005, MAP.z1);
  for (let z = Math.ceil(MAP.z0 / 4) * 4; z <= MAP.z1; z += 4) v.push(MAP.x0, 0.005, z, MAP.x1, 0.005, z);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  city.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: C.grid })));
}

// ribbon along a polyline; with height > 0 it becomes a closed strip (top + side walls)
function ribbon(xz, width, y, height = 0) {
  const pos = [], idx = [], hw = width / 2, n = xz.length;
  const L = [], R = [];
  for (let k = 0; k < n; k++) {
    const [x, z] = xz[k], a = xz[Math.max(0, k - 1)], b = xz[Math.min(n - 1, k + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    L.push([x - dz * hw, z + dx * hw]); R.push([x + dz * hw, z - dx * hw]);
  }
  const top = y + height;
  for (let k = 0; k < n; k++) pos.push(L[k][0], top, L[k][1], R[k][0], top, R[k][1]);
  for (let k = 0; k < n - 1; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  if (height > 0) {
    for (const side of [L, R]) {
      const base = pos.length / 3;
      for (let k = 0; k < n; k++) pos.push(side[k][0], y, side[k][1], side[k][0], top, side[k][1]);
      for (let k = 0; k < n - 1; k++) { const a = base + k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

const waterSegs = [];
WATER.forEach((w, i) => {
  const xz = w.p.map(proj);
  const m = new THREE.Mesh(ribbon(xz, w.w, 0.01), new THREE.MeshStandardMaterial({ color: i ? C.canal : C.water, roughness: 0.25, side: THREE.DoubleSide }));
  m.receiveShadow = true; city.add(m);
  for (let k = 1; k < xz.length; k++) waterSegs.push([xz[k - 1], xz[k], w.w / 2]);
});

const roadSegs = [];
const roadMats = [];
ROADS.forEach(r => {
  const w = r.c ? 0.3 : 0.2;
  const mat = new THREE.MeshStandardMaterial({ color: r.c ? C.major : C.road, roughness: 0.9, side: THREE.DoubleSide,
    transparent: !!r.tunnel, opacity: r.tunnel ? 0.45 : 1 });
  const m = new THREE.Mesh(ribbon(r.xz, w, r.bridge ? 0.12 : 0.03), mat);
  m.receiveShadow = true; city.add(m);
  roadMats.push(mat);
  if (r.flood != null) {
    r.slabMat = new THREE.MeshStandardMaterial({ color: LEVELS[0].c, transparent: true, opacity: 0.78, roughness: 0.2, side: THREE.DoubleSide });
    r.slab = new THREE.Mesh(ribbon(r.xz, w * 2.2, 0.035, 1), r.slabMat);
    r.slab.visible = false; city.add(r.slab);
  }
  if (!r.tunnel) for (let k = 1; k < r.xz.length; k++) roadSegs.push([r.xz[k - 1], r.xz[k], w / 2]);
});

// city blocks: deterministic, kept clear of streets and water, denser and taller around District 1
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const segDist = (x, z, [[ax, az], [bx, bz]]) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return Math.hypot(x - ax - u * dx, z - az - u * dz);
};
const blocks = [];
const [q1x, q1z] = proj([10.7760, 106.7000]);
const [ttx, ttz] = proj([10.7790, 106.7230]);
for (let x = MAP.x0 + 0.5; x < MAP.x1 - 0.4; x += 0.9) {
  for (let z = MAP.z0 + 0.5; z < MAP.z1 - 0.4; z += 0.9) {
    const jx = x + (rand() - 0.5) * 0.2, jz = z + (rand() - 0.5) * 0.2;
    if (waterSegs.some(s => segDist(jx, jz, s) < s[2] + 0.45)) continue;
    if (roadSegs.some(s => segDist(jx, jz, s) < s[2] + 0.42)) continue;
    const core = Math.exp(-((jx - q1x) ** 2 + (jz - q1z) ** 2) / 40);
    const thuThiem = Math.exp(-((jx - ttx) ** 2 + (jz - ttz) ** 2) / 14);
    if (rand() > 0.5 - thuThiem * 0.42) continue;
    const hgt = 0.1 + rand() ** 2.4 * (0.35 + 1.9 * core);
    blocks.push([jx, jz, 0.48 + rand() * 0.2, hgt, 0.48 + rand() * 0.2]);
  }
}
{
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: C.bld, roughness: 0.8 }), blocks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  blocks.forEach(([x, z, w, h, d], i) => {
    s.set(w, h, d); p.set(x, h / 2, z); m.compose(p, q, s); inst.setMatrixAt(i, m);
    inst.setColorAt(i, col.set(rand() < 0.2 ? C.bld2 : C.bld));
  });
  inst.castShadow = inst.receiveShadow = true;
  city.add(inst);
}
// two towers people recognise
function tower([lat, lon], h, r) {
  const [x, z] = proj([lat, lon]);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, h, 6), new THREE.MeshStandardMaterial({ color: C.tower, roughness: 0.5 }));
  m.position.set(x, h / 2, z); m.castShadow = true; city.add(m);
  return new THREE.Vector3(x, h + 0.3, z);
}
const lm81 = tower([10.7948, 106.7218], 6.5, 0.45);
const bitexco = tower([10.7716, 106.7044], 3.6, 0.3);

// sensors at the lowest point of each flood-prone street
const sensorGeo = new THREE.SphereGeometry(0.16, 16, 12), poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6);
const poleMat = new THREE.MeshStandardMaterial({ color: C.ink });
ROADS.filter(r => r.flood != null).forEach(r => {
  const [x, z] = r.xz[Math.floor(r.xz.length / 2)];
  const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(x, 0.4, z);
  r.sensorMat = new THREE.MeshStandardMaterial({ color: C.ink, emissive: 0x000000 });
  const head = new THREE.Mesh(sensorGeo, r.sensorMat); head.position.set(x, 0.85, z);
  city.add(pole, head);
  r.anchor = new THREE.Vector3(x, 1.1, z);
});

// start / goal
// every pickable place gets a small ring; origin and destination get solid pins that move
const ringGeo = new THREE.RingGeometry(0.2, 0.3, 24), ringMat = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.DoubleSide });
for (const k in PLACES) { const [x, z] = nodePos.get(k); const r = new THREE.Mesh(ringGeo, ringMat); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.07, z); city.add(r); }
function pin(color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 28), new THREE.MeshStandardMaterial({ color }));
  city.add(m); return m;
}
const startPin = pin(C.ink), goalPin = pin(C.route);
const startPos = new THREE.Vector3(), goalPos = new THREE.Vector3();
function placePins() {
  const [sx, sz] = nodePos.get(start), [gx, gz] = nodePos.get(goal);
  startPin.position.set(sx, 0.1, sz); goalPin.position.set(gx, 0.1, gz);
  startPos.set(sx, 0.4, sz); goalPos.set(gx, 0.4, gz);
}
placePins();

// route
const routeMat = new THREE.MeshStandardMaterial({ color: C.route, emissive: C.route, emissiveIntensity: 0.5, roughness: 0.4 });
let routeMesh = null, routePts = [];
const car = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: C.ink, emissive: C.route, emissiveIntensity: 0.3 }));
city.add(car);
function drawRoute(path) {
  if (routeMesh) { city.remove(routeMesh); routeMesh.geometry.dispose(); routeMesh = null; }
  car.visible = !!path; routePts = [];
  if (!path) return;
  routePts = path.map(({ key }) => { const [x, z] = nodePos.get(key); return new THREE.Vector3(x, 0.22, z); });
  const curve = new THREE.CurvePath();
  for (let k = 1; k < routePts.length; k++) curve.add(new THREE.LineCurve3(routePts[k - 1], routePts[k]));
  routeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, routePts.length * 6, 0.1, 8, false), routeMat);
  routeMesh.castShadow = true; city.add(routeMesh);
}

/* ================= labels (HTML, projected) ================= */
const labels = [];
function addLabel(pos, html, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || ''); el.innerHTML = html;
  labelLayer.appendChild(el);
  const l = { pos, el, on: true, prio: { pin: 100, place: 50, water: 40 }[(cls || '').split(' ')[0]] || 0 }; labels.push(l); return l;
}
const at = (lat, lon, y = 0.4) => { const [x, z] = proj([lat, lon]); return new THREE.Vector3(x, y, z); };
const startLabel = addLabel(startPos, '', 'pin'), goalLabel = addLabel(goalPos, '', 'pin goal');
addLabel(lm81, 'Landmark 81', 'place');
addLabel(at(10.7825, 106.7098, 0.1), '<span lang="vi">Sông Sài Gòn</span><span lang="en">Saigon River</span>', 'water');
ROADS.filter(r => r.flood != null).forEach(r => { r.label = addLabel(r.anchor, '', 'flood'); });

/* ================= state + panel ================= */
const slider = document.getElementById('level');
const out = { level: document.getElementById('r-level'), dist: document.getElementById('r-dist'), via: document.getElementById('r-via'), flooded: document.getElementById('r-flooded') };
const selFrom = document.getElementById('from'), selTo = document.getElementById('to');
function fillSelects() {
  for (const [sel, val] of [[selFrom, start], [selTo, goal]]) {
    sel.innerHTML = '';
    for (const k in PLACES) { const o = document.createElement('option'); o.value = k; o.textContent = placeName(k); sel.appendChild(o); }
    sel.value = val;
  }
}
function setEnds(s, g) {
  start = s; goal = g; selFrom.value = s; selTo.value = g;
  startLabel.el.textContent = placeName(s); goalLabel.el.textContent = placeName(g);
  startLabel.w = goalLabel.w = 0;
  placePins(); lastWater = -1; currentPath = undefined; applyWater();
}
selFrom.addEventListener('change', () => setEnds(selFrom.value, goal));
selTo.addEventListener('change', () => setEnds(start, selTo.value));
document.getElementById('swap').addEventListener('click', () => setEnds(goal, start));
let water = +slider.value, lastWater = -1, userTouched = false, currentPath = null;

function refreshPanel() {
  if (!out.level) return;
  out.level.textContent = `${Math.round(water)} cm`;
  const flooded = ROADS.filter(r => depthOf(r, water) > 0);
  out.flooded.textContent = String(new Set(flooded.map(r => r.n)).size);
  if (!currentPath) {
    out.dist.textContent = start === goal ? t('same') : t('none'); out.dist.classList.add('bad'); out.via.textContent = '—';
    return;
  }
  out.dist.classList.remove('bad');
  let len = 0; const byRoad = new Map();
  for (let k = 1; k < currentPath.length; k++) {
    const [x0, z0] = nodePos.get(currentPath[k - 1].key), [x1, z1] = nodePos.get(currentPath[k].key);
    const l = Math.hypot(x1 - x0, z1 - z0); len += l;
    const n = ROADS[currentPath[k].ri].n; byRoad.set(n, (byRoad.get(n) || 0) + l);
  }
  const km = (len * 0.25).toFixed(1);
  out.dist.textContent = `${root.dataset.lang === 'vi' ? km.replace('.', ',') : km} km`;
  out.via.textContent = [...byRoad].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n).join(', ');
}

function applyWater() {
  const wq = Math.round(water);
  if (wq === lastWater) return;
  lastWater = wq;
  ROADS.forEach(r => {
    if (r.flood == null) return;
    const d = depthOf(r, wq);
    r.slab.visible = d > 0;
    if (d > 0) {
      const lv = LEVELS[levelOf(d)];
      r.slabMat.color.setHex(lv.c);
      r.slab.geometry.dispose();
      r.slab.geometry = ribbon(r.xz, (r.c ? 0.3 : 0.2) * 2.2, 0.035, 0.04 + d * 0.012);
      r.sensorMat.color.setHex(lv.c); r.sensorMat.emissive.setHex(lv.c); r.sensorMat.emissiveIntensity = 0.45;
      r.label.on = true;
      r.label.el.innerHTML = `${r.n} <b>${Math.round(d)} cm</b>${d >= BLOCK_AT ? ' <i>✕</i>' : ''}`;
      r.label.w = 0; r.label.prio = d;
      r.label.el.style.setProperty('--lv', '#' + lv.c.toString(16).padStart(6, '0'));
    } else {
      r.sensorMat.color.setHex(C.ink); r.sensorMat.emissive.setHex(0); r.sensorMat.emissiveIntensity = 0;
      r.label.on = false;
    }
  });
  // one label per street name: keep the deepest
  const best = new Map();
  ROADS.forEach(r => { if (r.label && r.label.on) { const d = depthOf(r, wq), b = best.get(r.n); if (!b || d > b.d) best.set(r.n, { r, d }); } });
  ROADS.forEach(r => { if (r.label && r.label.on && best.get(r.n).r !== r) r.label.on = false; });

  const path = route(wq);
  const same = path && currentPath && path.length === currentPath.length && path.every((p, k) => p.key === currentPath[k].key);
  if (!same) { currentPath = path; drawRoute(path); }
  refreshPanel();
}
slider.addEventListener('input', () => { userTouched = true; water = +slider.value; applyWater(); });

/* ================= camera, drag, scroll choreography ================= */
let azimuth = Math.PI * 0.32, targetAz = azimuth, elevAngle = 0.78, dist = 82;
let dragging = false, lastX = 0;
let downX = 0, downY = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = downX = e.clientX; downY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!dragging) return; targetAz -= (e.clientX - lastX) * 0.006; lastX = e.clientX; });
// a click or tap (not a drag) sets the destination to the nearest place
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
canvas.addEventListener('pointerup', e => {
  dragging = false;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || smoothP > 0.2) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  if (!ray.ray.intersectPlane(ground, hit)) return;
  let best = null, bd = 3.2;
  for (const k in PLACES) { const [x, z] = nodePos.get(k), d = Math.hypot(x - hit.x, z - hit.z); if (d < bd) { bd = d; best = k; } }
  if (best && best !== start) setEnds(start, best);
});
canvas.addEventListener('pointercancel', () => { dragging = false; });

const nav = document.querySelector('.nav');
const heroFade = [document.querySelector('.hero-copy'), document.querySelector('.panel')];
const timeline = document.querySelector('.log');
const stops = timeline ? [...timeline.querySelectorAll('.row')] : [];
let scrollP = 0, smoothP = 0, visible = true, baseOffX = 0, baseOffY = 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = x => x * x * (3 - 2 * x);
function onScroll() {
  const vh = innerHeight;
  scrollP = clamp(scrollY / (vh * 1.15), 0, 1);
  visible = scrollY < vh * 2.2;
  nav.classList.toggle('solid', scrollY > vh * 0.55);
  if (timeline) {
    const r = timeline.getBoundingClientRect(), line = vh * 0.62;
    timeline.style.setProperty('--drawn', clamp((line - r.top) / r.height, 0, 1).toFixed(4));
    stops.forEach(li => li.classList.toggle('reached', li.getBoundingClientRect().top + 10 < line));
  }
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);

function placeCamera() {
  const e = ease(smoothP);
  const az = azimuth + e * 0.5, el = elevAngle + e * 0.6, d = dist * (1 + e * 0.35);
  camera.position.set(CX + Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d, CZ + Math.sin(az) * Math.cos(el) * d);
  camera.lookAt(CX, 0, CZ);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.setViewOffset(w, h, baseOffX * (1 - e), baseOffY * (1 - e) + h * 0.12 * e, w, h);
  camera.updateProjectionMatrix();
  const o = clamp(1 - e * 1.8, 0, 1);
  heroFade.forEach(el2 => { if (!el2) return; el2.style.opacity = String(o); el2.style.transform = e > 0.001 ? `translate3d(0, ${(-e * 70).toFixed(1)}px, 0)` : ''; });
  labelLayer.style.opacity = String(clamp(1 - e * 2.2, 0, 1));
}

function resize() {
  if (!renderer) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (w > 860) {
    // desktop: centre the map in the space right of the copy/controls column and size it to fit
    const col = document.querySelector('.panel'), edge = col.offsetLeft + col.offsetWidth + 24;
    const avail = Math.max(w - edge, w * 0.4);
    dist = 120 * Math.max(820 / avail, 580 / h, 0.8);
    baseOffX = -((edge + w) / 2 - w / 2); baseOffY = h * 0.03;
  } else {
    // phones: fit the map into the gap between the buttons and the panel (layout positions, unaffected by transforms)
    const copy = document.querySelector('.hero-copy'), cta = copy.querySelector('.cta'), panel = document.querySelector('.panel');
    const top = copy.offsetTop + cta.offsetTop + cta.offsetHeight, bottom = Math.min(panel.offsetTop, h);
    const gap = Math.max(bottom - top, h * 0.25);
    dist = 118 * clamp((h * 0.42) / gap, 0.9, 1.7);
    baseOffX = 0; baseOffY = h / 2 - (top + bottom) / 2;
  }
  scene.fog.near = dist * 1.4; scene.fog.far = dist * 2.4;
  placeCamera();
}

const v3 = new THREE.Vector3();
// labels are placed in priority order (start, goal, places, then deepest floods) and skipped if they would overlap
function placeLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight, taken = [];
  const order = labels.filter(l => l.on).sort((a, b) => (b.prio || 0) - (a.prio || 0));
  labels.forEach(l => { if (!l.on) l.el.style.display = 'none'; });
  for (const l of order) {
    v3.copy(l.pos).project(camera);
    if (v3.z > 1 || v3.x < -1.05 || v3.x > 1.05 || v3.y < -1.05 || v3.y > 1.05) { l.el.style.display = 'none'; continue; }
    const px = (v3.x + 1) / 2 * w, py = (1 - v3.y) / 2 * h;
    const lw = l.w || (l.el.style.display = '', l.w = l.el.offsetWidth), lh = 22;
    const box = [px - lw / 2, py - lh - 6, px + lw / 2, py - 6];
    if (taken.some(b => box[0] < b[2] + 4 && box[2] > b[0] - 4 && box[1] < b[3] + 2 && box[3] > b[1] - 2)) { l.el.style.display = 'none'; continue; }
    taken.push(box);
    l.el.style.display = '';
    l.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
  }
}

const clock = new THREE.Clock();
let carT = 0;
function frame() {
  requestAnimationFrame(frame);
  if (!visible || document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  if (!userTouched && !reduceMotion) {
    water = 28 + 27 * Math.sin(time * 0.22 - 1.4);           // rain + tide rises and falls on its own
    slider.value = String(Math.round(water));
    applyWater();
  }
  if (!dragging && !reduceMotion) targetAz += dt * 0.03;
  azimuth += (targetAz - azimuth) * 0.08;
  smoothP += (scrollP - smoothP) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 7));
  placeCamera();
  if (routePts.length > 1) {
    carT = reduceMotion ? 0.5 : (carT + dt * 0.05) % 1;
    const f = carT * (routePts.length - 1), k = Math.floor(f);
    car.position.lerpVectors(routePts[k], routePts[Math.min(k + 1, routePts.length - 1)], f - k);
    car.position.y += 0.12;
  }
  renderer.render(scene, camera);
  placeLabels();
}

const saved = store('lang');
setLang(saved === 'vi' || saved === 'en' ? saved : ((navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en'));
onScroll();
if (renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  addEventListener('resize', resize);
  resize();
  setEnds(start, goal);
  frame();
}
