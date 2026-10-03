// Generador del modelo 3D de Atlántida (data/atlantis.glb). Navegador + three r128 + BufferGeometryUtils + GLTFExporter.
// Unidades: metros. Y hacia arriba. buildAtlantis() devuelve {b64, tris, bytes}.
window.buildAtlantis = function () {
  const T = THREE, BU = T.BufferGeometryUtils;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bins = {};
  const put = (mat, g) => { (bins[mat] = bins[mat] || []).push(g.index ? g.toNonIndexed() : g); };
  const M = (g, x, y, z, ry = 0) => g.applyMatrix4(new T.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  const box = (w, h, d) => new T.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, s = 10) => new T.CylinderGeometry(rt, rb, h, s, 1).translate(0, h / 2, 0);
  const TAU = Math.PI * 2;
  const ring = (r0, r1, h, a0 = 0, a1 = TAU, seg = 128) => { // sector de anillo extruido, construido a mano (sin triangulación)
    const n = Math.max(4, Math.round(seg * (a1 - a0) / TAU)), P = [], N = [];
    const v = (a, r, y) => [Math.cos(a) * r, y, -Math.sin(a) * r];
    const quad = (p1, p2, p3, p4, nx, ny, nz) => { P.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4); for (let k = 0; k < 6; k++) N.push(nx, ny, nz); };
    for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n, tm = (t0 + t1) / 2;
      quad(v(t0, r0, h), v(t0, r1, h), v(t1, r1, h), v(t1, r0, h), 0, 1, 0);
      quad(v(t0, r1, 0), v(t1, r1, 0), v(t1, r1, h), v(t0, r1, h), Math.cos(tm), 0, -Math.sin(tm));
      quad(v(t1, r0, 0), v(t0, r0, 0), v(t0, r0, h), v(t1, r0, h), -Math.cos(tm), 0, Math.sin(tm)); }
    if (a1 - a0 < TAU - 1e-6) { quad(v(a0, r0, 0), v(a0, r1, 0), v(a0, r1, h), v(a0, r0, h), Math.sin(a0), 0, Math.cos(a0)); quad(v(a1, r1, 0), v(a1, r0, 0), v(a1, r0, h), v(a1, r1, h), -Math.sin(a1), 0, -Math.cos(a1)); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); return g; };
  const at = (r, a) => [Math.cos(a) * r, -Math.sin(a) * r];
  const CAN = [0, Math.PI / 2, Math.PI, Math.PI * 1.5], GAPW = 110; // canales radiales de 110 m
  const gapAt = r => (GAPW / 2) / r;
  const angD = (a, b) => Math.abs(((a - b) % TAU + TAU * 1.5) % TAU - Math.PI);
  const inCanal = (a, r, extra = 0) => CAN.some(c => angD(a, c) < gapAt(r) + extra / r);
  const segs = (r0, r1, h, mat, y = 0, seg = 96) => CAN.forEach((c, i) => { const g = gapAt(r1), a0 = c + g, a1 = (CAN[i + 1] ?? CAN[0] + TAU) - g; put(mat, ring(r0, r1, h, a0, a1, seg).translate(0, y, 0)); });
  const lampsOnCircle = (r, y, step, mat = 'lamp', h = 7) => { const n = Math.round(TAU * r / step); for (let i = 0; i < n; i++) { const a = i / n * TAU; if (inCanal(a, r, 8)) continue; const [x, z] = at(r, a); put('bronze', M(cyl(.8, 1, h, 4), x, y, z)); put(mat, M(new T.OctahedronGeometry(2.2, 0), x, y + h + 1, z)); } };

  // ================= TERRENO: anillos de Platón =================
  const R = { isl: 520, w1: [520, 720], r1: [720, 1180], w2: [1180, 1380], r2: [1380, 2080], wall: [2080, 2130] };
  put('stone', ring(0, R.isl, 18, 0, TAU, 160));
  segs(R.r1[0], R.r1[1], 12, 'stone'); segs(R.r2[0], R.r2[1], 10, 'stone');
  segs(R.r1[0] + 18, R.r1[1] - 18, 1.2, 'grass', 12); segs(R.r2[0] + 18, 1580, 1.2, 'grass', 10); segs(1900, R.r2[1] - 18, 1.2, 'grass', 10);
  // muelles de mármol con barandilla y farolas en cada orilla
  [[R.isl - 14, R.isl, 18, true], [R.r1[0], R.r1[0] + 16, 12], [R.r1[1] - 16, R.r1[1], 12], [R.r2[0], R.r2[0] + 16, 10]].forEach(([a, b, y, full]) => {
    if (full) put('marble', ring(a, b, 3, 0, TAU, 128).translate(0, y, 0)); else segs(a, b, 3, 'marble', y);
    if (full) put('trim', ring(b - 1.5, b, 4.5, 0, TAU, 128).translate(0, y + 3, 0)); else segs(b - 1.5, b, 4.5, 'trim', y + 3); });
  [[R.isl - 6, 21], [R.r1[0] + 8, 15], [R.r1[1] - 8, 15], [R.r2[0] + 8, 13]].forEach(([r, y]) => lampsOnCircle(r, y, 64));
  // muelles de los canales radiales
  CAN.forEach(c => [-1, 1].forEach(sd => [[R.r1[0], R.r1[1], 12], [R.r2[0], R.r2[1], 10]].forEach(([r0, r1, y]) => {
    const L = r1 - r0, rm = (r0 + r1) / 2, a = c + sd * gapAt(rm), [x, z] = at(rm, a);
    put('stone', M(box(L, 4, 8), x, y, z, c)); put('trim', M(box(L, 1, 1.4), x, y + 4, z, c));
    for (let k = 0; k <= L / 70; k++) { const rr = r0 + k * 70, [lx, lz] = at(rr, c + sd * (gapAt(rr) + 6 / rr)); put('bronze', M(cyl(.8, 1, 8, 4), lx, y + 5, lz)); put('lamp', M(new T.OctahedronGeometry(2.3, 0), lx, y + 14, lz)); } })));

  // ================= MURALLA DE ORICALCO y TORRES DE LOS CANALES =================
  segs(R.wall[0], R.wall[1], 70, 'ori', 10); segs(R.wall[0] - 4, R.wall[1] + 4, 7, 'trim', 80);
  for (let i = 0; i < 56; i++) { const a = i / 56 * TAU, r = (R.wall[0] + R.wall[1]) / 2; if (inCanal(a, r, 60)) continue; const [x, z] = at(r, a);
    put('ori', M(cyl(24, 28, 120, 14), x, 10, z)); put('trim', M(cyl(27, 27, 4, 14), x, 130, z)); put('roof2', M(cyl(0, 30, 46, 14), x, 134, z)); put('lamp', M(new T.SphereGeometry(4, 8, 6), x, 182, z)); }
  const tower = (x, z, H, R0, glow) => { let y = 10, r = R0; const stages = 6;
    for (let s = 0; s < stages; s++) { const h = H / stages * (s === 0 ? 1.3 : .95); put(s % 2 ? 'marble' : 'ori', M(cyl(r * .92, r, h, 16), x, y, z)); put('trim', M(cyl(r * 1.08, r * 1.08, 3, 16), x, y + h, z));
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; put('win', M(box(r * .25, h * .35, 1), x + Math.cos(a) * r * .93, y + h * .35, z + Math.sin(a) * r * .93, -a + Math.PI / 2)); }
      y += h + 3; r *= .82; }
    put('ori', M(cyl(0, r * 1.3, H * .28, 16), x, y, z)); put(glow, M(new T.OctahedronGeometry(r * .9, 0), x, y + H * .28 + r, z)); };
  CAN.forEach(c => [-1, 1].forEach(sd => { const r = 2150, a = c + sd * (gapAt(r) + 40 / r), [x, z] = at(r, a); tower(x, z, 300, 46, 'core'); }));
  // faro del puerto
  { const [x, z] = at(2420, Math.PI * 1.25); put('stone', M(cyl(70, 80, 14, 16), x, 0, z)); tower(x, z, 380, 40, 'lamp'); }

  // ================= HIPÓDROMO GIGANTE (anillo exterior, ~10 km de pista) =================
  const T0 = 1650, T1 = 1790; // pista
  segs(T0, T1, 1, 'sand', 10.5, 120);
  segs(1714, 1726, 8, 'marble', 10.5, 120); // spina
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; if (inCanal(a, 1720, 30)) continue; const [x, z] = at(1720, a); put(i % 2 ? 'marble' : 'ori', M(cyl(1.5, 4, i % 2 ? 46 : 30, 4), x, 18.5, z, -a)); }
  // gradas: 8 escalones a cada lado, subiendo hacia fuera de la pista
  for (let k = 0; k < 8; k++) { segs(T0 - 10 - (k + 1) * 8, T0 - 10 - k * 8, 8 + k * 6, 'marble', 10, 110); segs(T1 + 10 + k * 8, T1 + 10 + (k + 1) * 8, 8 + k * 6, 'marble', 10, 110); }
  // fachada de arcos en el borde exterior de las gradas
  const AR = T1 + 10 + 8 * 8 + 6; segs(AR, AR + 8, 64, 'plaster', 10, 120); segs(AR - 1, AR + 9, 4, 'trim', 74, 120);
  { const n = Math.round(TAU * AR / 34); for (let i = 0; i < n; i++) { const a = i / n * TAU; if (inCanal(a, AR, 10)) continue; const [x, z] = at(AR + 8.6, a); put('stone', M(box(10, 34, 1.4), x, 18, z, -a + Math.PI / 2)); put('win', M(box(9, 2, 1.2), x, 54, z, -a + Math.PI / 2)); } }
  // cuadrigas en la pista
  for (let i = 0; i < 36; i++) { const a = rnd() * TAU, r = T0 + 20 + rnd() * (T1 - T0 - 40); if (inCanal(a, r, 20)) continue; const [x, z] = at(r, a);
    put('ori', M(box(5, 4, 3), x, 11.5, z, -a)); for (let h = 0; h < 4; h++) put('plaster', M(box(3, 3, 1), x + Math.cos(-a) * 6, 11.5, z + Math.sin(-a) * 6 + (h - 1.5) * 1.3, -a)); }
  lampsOnCircle(T0 - 4, 10.5, 70, 'lamp', 10); lampsOnCircle(T1 + 4, 10.5, 70, 'lamp', 10);

  // ================= TEMPLOS =================
  const temple = (cx, cz, rot, L, W, H, colR, y0b = 12) => {
    const Rm = new T.Matrix4().makeRotationY(rot).setPosition(cx, 0, cz), add = (mat, g) => put(mat, g.applyMatrix4(Rm));
    for (let k = 0; k < 4; k++) add('marble', box(L + 32 - k * 8, 4, W + 32 - k * 8).translate(0, y0b + k * 4, 0));
    const y0 = y0b + 16, nl = Math.round(L / (colR * 4.4)), nw = Math.round(W / (colR * 4.4));
    for (let i = 0; i <= nl; i++) for (const sz of [-1, 1]) { const x = -L / 2 + i * L / nl; add('marble', cyl(colR * .82, colR, H, 8).translate(x, y0, sz * W / 2)); add('marble', box(colR * 2.6, colR * .9, colR * 2.6).translate(x, y0 + H, sz * W / 2)); }
    for (let j = 1; j < nw; j++) for (const sx of [-1, 1]) { const z = -W / 2 + j * W / nw; add('marble', cyl(colR * .82, colR, H, 8).translate(sx * L / 2, y0, z)); }
    add('plaster', box(L * .8, H * .92, W * .66).translate(0, y0, 0)); add('core', box(L * .8 + .4, 3, W * .66 + .4).translate(0, y0 + H * .5, 0));
    add('marble', box(L + colR * 3, colR * 2.4, W + colR * 3).translate(0, y0 + H + colR * .9, 0));
    add('trim', box(L + colR * 3.3, 1.8, W + colR * 3.3).translate(0, y0 + H + colR * 3.3, 0));
    const hw = W / 2 + colR * 1.9, hr = W * .22, sh = new T.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, hr); sh.closePath();
    const rf = new T.ExtrudeGeometry(sh, { depth: L + colR * 3.6, bevelEnabled: false }); rf.translate(0, 0, -(L + colR * 3.6) / 2); rf.rotateY(Math.PI / 2); add('roof', rf.translate(0, y0 + H + colR * 3.3 + 1.8, 0));
    add('ori', new T.ConeGeometry(colR * 1.6, colR * 4, 6).translate(0, y0 + H + colR * 3.3 + 1.8 + hr + colR * 2, 0));
    for (let i = 0; i < 4; i++) { add('bronze', cyl(1.2, 1.6, 12, 6).translate((i < 2 ? -1 : 1) * (L / 2 + 22), y0b, (i % 2 ? -1 : 1) * (W / 2 + 22))); add('lamp', new T.OctahedronGeometry(3.4, 0).translate((i < 2 ? -1 : 1) * (L / 2 + 22), y0b + 15, (i % 2 ? -1 : 1) * (W / 2 + 22))); }
  };
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8, [x, z] = at(950, a); temple(x, z, a + Math.PI / 2, 190, 92, 58, 5.2); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + Math.PI / 12, [x, z] = at(1480, a); if (inCanal(a, 1480, 120)) continue; temple(x, z, a + Math.PI / 2, 110, 56, 36, 3.6, 10); }

  // ================= TORRES DEL SABER (anillo interior) =================
  const spire = (x, z, H) => { const n = 5; let y = 12, r = 22; for (let s = 0; s < n; s++) { const h = H / n; put('marble', M(cyl(r * .9, r, h, 8), x, y, z, Math.PI / 8)); put('ori', M(cyl(r * 1.05, r * 1.05, 2.5, 8), x, y + h, z, Math.PI / 8));
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; put('win', M(box(r * .3, h * .5, .8), x + Math.cos(a) * r * .86, y + h * .25, z + Math.sin(a) * r * .86, -a + Math.PI / 2)); }
      y += h + 2.5; r *= .8; }
    put('ori', M(cyl(0, r, H * .35, 8), x, y, z, Math.PI / 8)); put('core', M(new T.SphereGeometry(r * .7, 10, 8), x, y + H * .35 + 4, z)); };
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, [x, z] = at(1080, a + .14); spire(x, z, 120); }

  // ================= BARRIOS =================
  const house = (x, z, rot, y0, mat) => { const w = 14 + rnd() * 18, d = 12 + rnd() * 14, h = 12 + rnd() * 26, Rm = new T.Matrix4().makeRotationY(rot).setPosition(x, y0, z);
    put(mat, box(w, h, d).applyMatrix4(Rm)); const rf = new T.ConeGeometry(Math.max(w, d) * .72, 8 + rnd() * 6, 4); rf.rotateY(Math.PI / 4); rf.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
    put(rnd() < .3 ? 'roof2' : 'roof', rf.translate(0, h + 5, 0).applyMatrix4(Rm));
    if (rnd() < .7) put('win', new T.PlaneGeometry(w * .55, h * .5).translate(0, h * .45, d / 2 + .4).applyMatrix4(Rm)); };
  const pick = () => ['marble', 'plaster', 'plaster2', 'plaster3'][Math.floor(rnd() * 4)];
  const busy = (a, r) => { for (let i = 0; i < 8; i++) { if (angD(a, i / 8 * TAU + Math.PI / 8) < .17 && r > 830 && r < 1080) return true; if (angD(a, i / 8 * TAU + .14) < 40 / r && Math.abs(r - 1080) < 40) return true; } return false; };
  for (let i = 0; i < 560; i++) { const a = rnd() * TAU, r = R.r1[0] + 30 + rnd() * (R.r1[1] - R.r1[0] - 60); if (inCanal(a, r, 25) || busy(a, r)) continue; const [x, z] = at(r, a); house(x, z, -a + (rnd() - .5) * .3, 13.2, pick()); }
  for (let i = 0; i < 700; i++) { const outer = rnd() < .5, a = rnd() * TAU, r = outer ? 1905 + rnd() * 150 : 1400 + rnd() * 160; if (inCanal(a, r, 25)) continue; if (!outer && angD(a, Math.round((a - Math.PI / 12) / (TAU / 12)) * (TAU / 12) + Math.PI / 12) < 80 / r && Math.abs(r - 1480) < 60) continue;
    const [x, z] = at(r, a); house(x, z, -a + (rnd() - .5) * .3, 11.2, pick()); }
  for (let i = 0; i < 520; i++) { const a = rnd() * TAU, r = rnd() < .55 ? 760 + rnd() * 380 : (rnd() < .5 ? 1400 + rnd() * 170 : 1905 + rnd() * 150); if (inCanal(a, r, 20)) continue; const y = r < 1200 ? 13.2 : 11.2, [x, z] = at(r, a), h = 12 + rnd() * 18;
    put('trunk', M(cyl(1.3, 2, h * .4, 4), x, y, z)); put(rnd() < .3 ? 'leaf2' : 'leaf', M(new T.ConeGeometry(6 + rnd() * 5, h, 6).translate(0, h * .4 + h / 2, 0), x, y, z)); }

  // ================= PUENTES =================
  const bridge = (cx, cz, rot, L, Wd, y) => { const Rm = new T.Matrix4().makeRotationY(rot).setPosition(cx, 0, cz), add = (m, g) => put(m, g.applyMatrix4(Rm));
    add('marble', box(L, 6, Wd).translate(0, y, 0)); add('trim', box(L, 1.2, 1.5).translate(0, y + 6, Wd / 2)); add('trim', box(L, 1.2, 1.5).translate(0, y + 6, -Wd / 2));
    const n = Math.max(2, Math.round(L / 60)); for (let k = 0; k < n; k++) { const arc = new T.TorusGeometry(L / n / 2, 4, 4, 10, Math.PI); arc.translate(-L / 2 + L / n / 2 + k * L / n, y - L / n / 2 + 1, 0); add('marble', arc.clone().translate(0, 0, Wd / 2)); add('marble', arc.translate(0, 0, -Wd / 2)); add('stone', box(8, y, Wd).translate(-L / 2 + k * L / n, 0, 0)); }
    for (let k = 0; k <= n * 2; k++) for (const sd of [-1, 1]) { add('bronze', cyl(.8, 1, 9, 4).translate(-L / 2 + k * L / (n * 2), y + 6, sd * (Wd / 2))); add('lamp', new T.OctahedronGeometry(2.3, 0).translate(-L / 2 + k * L / (n * 2), y + 16, sd * (Wd / 2))); } };
  CAN.forEach(c => { [[R.w1[0] - 10, R.w1[1] + 10, 18], [R.w2[0] - 10, R.w2[1] + 10, 14]].forEach(([r0, r1, y]) => { const [x, z] = at((r0 + r1) / 2, c); bridge(x, z, c, r1 - r0, 50, y); });
    [[950, 14], [1290, 0], [1700, 12]].forEach(([r, y]) => { if (!y) return; const [x, z] = at(r, c); bridge(x, z, c + Math.PI / 2, GAPW + 40, 34, y + 8); }); });

  // ================= ACRÓPOLIS y TEMPLO-ALMACÉN DE DATOS =================
  [[470, 18, 26], [370, 44, 26], [280, 70, 26]].forEach(([r, y, h]) => { put('marble', M(cyl(r, r + 8, h, 128), 0, y, 0)); put('trim', M(cyl(r + 1, r + 1, 2, 128), 0, y + h, 0)); lampsOnCircle(r - 6, y + h, 45); });
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU, [x, z] = at(452, a); put('marble', M(cyl(2.6, 3, 22, 6), x, 44, z)); }
  CAN.concat(CAN.map(c => c + Math.PI / 4)).forEach((c, ci) => { for (let k = 0; k < 3; k++) { const r = [470, 370, 280][k]; for (let st = 0; st < 6; st++) { const [x, z] = at(r + 30 - st * 6, c); put('marble', M(box(70 - (ci > 3 ? 30 : 0), 18 + k * 26 + st * 4.3 - 18 - k * 26 + 4, 12), x, 18 + k * 26, z, -c + Math.PI / 2)); } } });
  const yT = 96;
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, [x, z] = at(210, a); put('marble', M(cyl(7, 8.5, 100, 14), x, yT, z)); put('ori', M(box(17, 6, 17), x, yT + 100, z)); }
  put('marble', M(cyl(222, 222, 12, 128), 0, yT + 106, 0)); put('trim', M(cyl(223, 223, 3, 128), 0, yT + 118, 0));
  const dome = new T.SphereGeometry(215, 72, 28, 0, TAU, 0, Math.PI / 2); dome.scale(1, .66, 1); put('ori', dome.translate(0, yT + 118, 0));
  for (let i = 0; i < 32; i++) { const rib = new T.TorusGeometry(215.5, 2.4, 5, 56, Math.PI / 2); rib.scale(1, .66, 1); rib.rotateY(i / 32 * TAU); put('trim', rib.translate(0, yT + 118, 0)); }
  put('trim', M(cyl(36, 36, 8, 24), 0, yT + 118 + 140, 0));
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, [x, z] = at(150, a); put('server', M(box(16, 80, 28), x, yT, z, -a)); for (let k = 0; k < 7; k++) put('core', M(box(16.8, 2.2, 28.8), x, yT + 8 + k * 10, z, -a)); }
  put('core', M(cyl(50, 56, 100, 40), 0, yT, 0));
  put('core', M(new T.ConeGeometry(30, 380, 10).translate(0, 190, 0), 0, yT + 230, 0));
  put('core', M(new T.OctahedronGeometry(44, 0), 0, yT + 640, 0));
  [[275, 6.5, 270], [205, 5.5, 360], [135, 4.5, 450], [75, 3.5, 540]].forEach(([r, t, y]) => { const tor = new T.TorusGeometry(r, t, 8, 128); tor.rotateX(Math.PI / 2); put('rings', tor.translate(0, y, 0)); });
  // fuentes alrededor del templo
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8, [x, z] = at(330, a); put('marble', M(cyl(22, 24, 4, 20), x, 70, z)); put('water2', M(cyl(19, 19, 4.5, 20), x, 70, z)); put('jet', M(new T.ConeGeometry(4, 34, 8).translate(0, 17, 0), x, 74, z)); }

  // ================= TRIDENTE, OBELISCOS Y BARCOS =================
  { const [x, z] = at(2330, Math.PI * 1.5); put('stone', M(cyl(40, 50, 12, 12), x, 0, z)); put('ori', M(cyl(10, 14, 280, 12), x, 12, z)); put('ori', M(box(130, 14, 14), x, 290, z)); [-58, 0, 58].forEach(dx => { put('ori', M(cyl(0, 10, 110, 8), x + dx, 304, z)); put('core', M(new T.OctahedronGeometry(9, 0), x + dx, 424, z)); }); }
  CAN.forEach(c => [-1, 1].forEach(sd => { const r = 1280, [x, z] = at(r, c + sd * (gapAt(r) + 30 / r)); put('marble', M(cyl(4, 10, 140, 4), x, 0, z, Math.PI / 4)); put('trim', M(cyl(0, 7, 18, 4), x, 140, z, Math.PI / 4)); }));
  const ship = (bin, r, a) => { const [x, z] = at(r, a), Rm = new T.Matrix4().makeRotationY(-a + Math.PI / 2 * (rnd() < .5 ? 1 : -1)).setPosition(x, 0, z), add = (m, g) => put(m, g.applyMatrix4(Rm));
    add(bin + 'Hull', new T.CylinderGeometry(7, 3.5, 70, 8).rotateZ(Math.PI / 2).scale(1, .55, 1).translate(0, 3, 0)); add(bin + 'Hull', cyl(.9, .9, 40, 5).translate(0, 4, 0)); add(bin + 'Sail', box(26, 24, .6).translate(0, 14, 0)); add(bin + 'Lamp', new T.SphereGeometry(1.6, 6, 4).translate(30, 8, 0)); };
  for (let i = 0; i < 26; i++) { const a = i / 26 * TAU + rnd() * .1; if (inCanal(a, 1280, 60)) continue; ship('boatA', 1240 + rnd() * 90, a); }
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rnd() * .2; if (inCanal(a, 620, 40)) continue; ship('boatB', 590 + rnd() * 60, a); }

  // ================= MATERIALES =================
  const S = (o) => new T.MeshStandardMaterial(o);
  const MAT = {
    stone: S({ color: 0x2b3150, roughness: .95 }), grass: S({ color: 0x1f4a3c, roughness: 1 }), sand: S({ color: 0xa08a62, roughness: 1 }),
    marble: S({ color: 0xece5d4, roughness: .42 }), plaster: S({ color: 0xd8c7a6, roughness: .8 }), plaster2: S({ color: 0xc9b48f, roughness: .85 }), plaster3: S({ color: 0xa9b6c4, roughness: .8 }),
    ori: S({ color: 0xc8743a, roughness: .3, metalness: .85, emissive: 0x2a1000 }), bronze: S({ color: 0x7a5a32, roughness: .4, metalness: .8 }),
    trim: S({ color: 0xffc070, roughness: .3, metalness: .6, emissive: 0xff9a3c }),
    roof: S({ color: 0x9c4a2c, roughness: .7 }), roof2: S({ color: 0x2f6f74, roughness: .45, metalness: .5 }),
    win: S({ color: 0xffd58a, emissive: 0xffc46a }), lamp: S({ color: 0xfff1c9, emissive: 0xffd27a }),
    server: S({ color: 0x141c3a, roughness: .35, metalness: .7 }), core: S({ color: 0x9ff8ff, emissive: 0x35e0ff, roughness: .1 }), rings: S({ color: 0xbffcff, emissive: 0x4ae8ff, roughness: .1 }),
    water2: S({ color: 0x1aa6c9, emissive: 0x0b5f7a, roughness: .05, metalness: .3 }), jet: S({ color: 0xcffaff, emissive: 0x7fe8ff, transparent: true, opacity: .8 }),
    trunk: S({ color: 0x4a3426, roughness: 1 }), leaf: S({ color: 0x2f6b4a, roughness: .9 }), leaf2: S({ color: 0x3f7a3a, roughness: .9 }),
  };
  ['boatA', 'boatB'].forEach(b => { MAT[b + 'Hull'] = S({ color: 0x5a3b26, roughness: .9 }); MAT[b + 'Sail'] = S({ color: 0xf2e8d5, roughness: .9, side: T.DoubleSide }); MAT[b + 'Lamp'] = S({ color: 0xfff1c9, emissive: 0xffd27a }); });
  const scene = new T.Scene(); let tris = 0;
  for (const [k, list] of Object.entries(bins)) {
    const clean = list.map(g => { const n = new T.BufferGeometry(); n.setAttribute('position', g.getAttribute('position')); n.setAttribute('normal', g.getAttribute('normal')); return n; });
    let g = BU.mergeBufferGeometries(clean); g = BU.mergeVertices(g, 0.01); tris += g.index.count / 3; (window._bt = window._bt || {})[k] = g.index.count / 3;
    const m = new T.Mesh(g, MAT[k]); m.name = k; scene.add(m);
  }
  return new Promise(res => new T.GLTFExporter().parse(scene, ab => { const u8 = new Uint8Array(ab); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); res({ b64: btoa(s), tris, bytes: u8.length }); }, { binary: true }));
};
