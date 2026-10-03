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
  // columna clásica: basa, fuste acanalado con éntasis y capitel
  const shaftCache = {};
  const shaft = (r, h) => { const key = r.toFixed(2) + '_' + h.toFixed(1); if (shaftCache[key]) return shaftCache[key].clone();
    const seg = 20, g = new T.CylinderGeometry(r * .86, r, h, seg, 2, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(z, x), v = (y + h / 2) / h;
      const k = Math.round(((th / TAU) * seg + seg) % seg) % 2 ? .9 : 1, ent = 1 + .045 * Math.sin(Math.PI * Math.min(1, v * 1.15));
      p.setX(i, x * k * ent); p.setZ(i, z * k * ent); }
    g.computeVertexNormals(); g.translate(0, h / 2, 0); shaftCache[key] = g; return g.clone(); };
  const column = (add, x, y, z, r, H) => { add('marble', box(r * 2.7, r * .32, r * 2.7).translate(x, y, z)); const tb = new T.TorusGeometry(r * 1.08, r * .18, 3, 10); tb.rotateX(Math.PI / 2); add('marble', tb.translate(x, y + r * .4, z));
    const sh = H - r * 1.3; add('marble', shaft(r, sh).translate(x, y + r * .5, z));
    add('marble', cyl(r * 1.22, r * .88, r * .42, 10).translate(x, y + r * .5 + sh, z)); add('marble', box(r * 2.7, r * .36, r * 2.7).translate(x, y + r * .92 + sh, z)); };
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
  { const n = Math.round(TAU * 2105 / 13); for (let i = 0; i < n; i++) { const a = i / n * TAU; if (inCanal(a, 2105, 30)) continue; for (const rr of [R.wall[0] - 2, R.wall[1] + 2]) { const [x, z] = at(rr, a); put('ori', M(box(7, 7, 4), x, 87, z, -a + Math.PI / 2)); } } }
  segs(R.wall[1], R.wall[1] + 5, 16, 'stone', 0, 140); segs(R.wall[0] - 5, R.wall[0], 16, 'stone', 0, 140);
  { const n = Math.round(TAU * R.wall[1] / 28); for (let i = 0; i < n; i++) { const a = (i + .5) / n * TAU; if (inCanal(a, R.wall[1], 40)) continue; const [x, z] = at(R.wall[1] + 2, a); put('ori', M(box(5, 60, 4), x, 16, z, -a + Math.PI / 2)); put('trim', M(box(6, 1.6, 5), x, 62, z, -a + Math.PI / 2)); } }
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
    for (let k = 0; k < 8; k++) add('marble', box(L + 34 - k * 4, 2, W + 34 - k * 4).translate(0, y0b + k * 2, 0)); // crepidoma: 8 peldaños reales
    const y0 = y0b + 16, nl = Math.round(L / (colR * 4.4)), nw = Math.round(W / (colR * 4.4));
    for (let i = 0; i <= nl; i++) for (const sz of [-1, 1]) column(add, -L / 2 + i * L / nl, y0, sz * W / 2, colR, H);
    for (let j = 1; j < nw; j++) for (const sx of [-1, 1]) column(add, sx * L / 2, y0, -W / 2 + j * W / nw, colR, H);
    // segunda fila de columnas en la fachada principal (pronaos)
    for (let j = 1; j < nw; j++) column(add, L / 2 - colR * 4.4, y0, -W / 2 + j * W / nw, colR * .9, H);
    // cella con puerta de bronce y rendija de luz
    add('plaster', box(L * .74, H * .96, W * .62).translate(-colR * 2, y0, 0));
    add('bronze', box(1.2, H * .62, W * .2).translate(L * .37 - colR * 2 + .3, y0, 0)); add('win', box(1.4, H * .62, 1.2).translate(L * .37 - colR * 2 + .4, y0, 0));
    add('core', box(L * .74 + .4, 2, W * .62 + .4).translate(-colR * 2, y0 + H * .55, 0));
    // entablamento: arquitrabe, friso con triglifos, cornisa volada
    const ya = y0 + H, EL = L + colR * 2.8, EW = W + colR * 2.8;
    add('marble', box(EL, colR * 1.3, EW).translate(0, ya, 0));
    add('trim', box(EL + .6, .7, EW + .6).translate(0, ya + colR * 1.3, 0));
    add('marble', box(EL - .8, colR * 1.5, EW - .8).translate(0, ya + colR * 1.3 + .7, 0));
    const tg = colR * 2.2, yf = ya + colR * 1.3 + .7;
    for (let x = -EL / 2 + tg / 2; x < EL / 2; x += tg) for (const sz of [-1, 1]) add('marble', box(colR * .9, colR * 1.5, .9).translate(x, yf, sz * (EW / 2 - .2)));
    for (let z = -EW / 2 + tg / 2; z < EW / 2; z += tg) for (const sx of [-1, 1]) add('marble', box(.9, colR * 1.5, colR * .9).translate(sx * (EL / 2 - .2), yf, z));
    const yc = yf + colR * 1.5; add('marble', box(EL + colR * 1.6, colR * .7, EW + colR * 1.6).translate(0, yc, 0)); add('trim', box(EL + colR * 1.8, .8, EW + colR * 1.8).translate(0, yc + colR * .7, 0));
    // frontón con cornisa inclinada, tejado y acróteras
    const yr = yc + colR * .7 + .8, hw = EW / 2 + colR * .8, hr = W * .2, len = EL + colR * 1.6, sh = new T.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, hr); sh.closePath();
    const rf = new T.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); rf.translate(0, 0, -len / 2); rf.rotateY(Math.PI / 2); add('roof', rf.translate(0, yr, 0));
    const sl = Math.hypot(hw, hr), ang = Math.atan2(hr, hw);
    for (const sx of [-1, 1]) { add('marble', box(colR * .9, colR * .8, hw * 2).translate(sx * (len / 2 + .2), yr - colR * .2, 0));
      { const fr = new T.Shape(); fr.moveTo(-hw - 1.2, -.6); fr.lineTo(hw + 1.2, -.6); fr.lineTo(0, hr + 1.4); fr.closePath(); const hole = new T.Path(); hole.moveTo(-hw + 2.6, 1); hole.lineTo(hw - 2.6, 1); hole.lineTo(0, hr - 1.6); hole.closePath(); fr.holes.push(hole);
        const fg = new T.ExtrudeGeometry(fr, { depth: 2.4, bevelEnabled: false }); fg.rotateY(Math.PI / 2); add('marble', fg.translate(sx * (len / 2) + (sx > 0 ? -1 : -1.4), yr, 0)); }
      add('ori', new T.ConeGeometry(colR * 1.1, colR * 3.2, 6).translate(sx * (len / 2), yr + hr + colR * 1.9, 0));
      for (const sz of [-1, 1]) add('ori', new T.ConeGeometry(colR * .7, colR * 2.2, 6).translate(sx * (len / 2), yr + colR * 1.2, sz * hw)); }
    for (let i = 0; i < 4; i++) { add('bronze', cyl(1.2, 1.6, 12, 6).translate((i < 2 ? -1 : 1) * (L / 2 + 24), y0b, (i % 2 ? -1 : 1) * (W / 2 + 24))); add('lamp', new T.OctahedronGeometry(3.4, 0).translate((i < 2 ? -1 : 1) * (L / 2 + 24), y0b + 15, (i % 2 ? -1 : 1) * (W / 2 + 24))); }
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
  const house = (x, z, rot, y0, mat) => { const w = 14 + rnd() * 18, d = 12 + rnd() * 14, h = 12 + rnd() * 26, Rm = new T.Matrix4().makeRotationY(rot).setPosition(x, y0, z), add = (m, g) => put(m, g.applyMatrix4(Rm));
    add('stone', box(w + 1.2, 2.2, d + 1.2)); add(mat, box(w, h, d)); add('trim', box(w + .8, .6, d + .8).translate(0, h * .5, 0));
    // ventanas por planta en fachada y laterales (unas encendidas, otras no)
    const fl = Math.max(1, Math.floor((h - 4) / 6.5)), fw = (ww, dz, rotY) => { const nc = Math.max(1, Math.floor(ww / 6)); for (let f = 0; f < fl; f++) for (let c = 0; c < nc; c++) {
        const g = new T.PlaneGeometry(2.2, 3.2); if (rotY) g.rotateY(rotY); const off = -ww / 2 + (c + .5) * ww / nc, yy = 5 + f * 6.5;
        g.translate(rotY ? dz : off, yy, rotY ? off : dz); add(rnd() < .42 ? 'win' : 'winOff', g); } };
    fw(w, d / 2 + .15, 0); fw(d, w / 2 + .15, Math.PI / 2); if (rnd() < .5) fw(w, -d / 2 - .15, Math.PI);
    add('bronze', new T.PlaneGeometry(3, 4.6).translate(w * (rnd() - .5) * .5, 4.5, d / 2 + .2));
    if (rnd() < .28) { // azotea con pretil y pérgola
      add(mat, box(w, 2.4, .8).translate(0, h, d / 2 - .4)); add(mat, box(w, 2.4, .8).translate(0, h, -d / 2 + .4)); add(mat, box(.8, 2.4, d).translate(w / 2 - .4, h, 0)); add(mat, box(.8, 2.4, d).translate(-w / 2 + .4, h, 0));
      if (rnd() < .6) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('trunk', box(.6, 4.5, .6).translate(sx * w * .25, h, sz * d * .25)); add('leaf', box(w * .55, .5, d * .55).translate(0, h + 4.5, 0)); }
    } else { const rf = new T.ConeGeometry(Math.max(w, d) * .76, 7 + rnd() * 6, 4); rf.rotateY(Math.PI / 4); rf.scale((w + 2.4) / Math.max(w, d), 1, (d + 2.4) / Math.max(w, d)); add(rnd() < .3 ? 'roof2' : 'roof', rf.translate(0, h + 4.5, 0)); add('trim', box(w + 2.2, .5, d + 2.2).translate(0, h, 0)); } };
  const pick = () => ['marble', 'plaster', 'plaster2', 'plaster3'][Math.floor(rnd() * 4)];
  const busy = (a, r) => { for (let i = 0; i < 8; i++) { if (angD(a, i / 8 * TAU + Math.PI / 8) < .17 && r > 830 && r < 1080) return true; if (angD(a, i / 8 * TAU + .14) < 40 / r && Math.abs(r - 1080) < 40) return true; } return false; };
  segs(1112, 1140, 1.6, 'stone', 12.2, 120); lampsOnCircle(1110, 13.8, 40); lampsOnCircle(1142, 13.8, 40);
  for (let i = 0; i < 560; i++) { const a = rnd() * TAU, r = R.r1[0] + 30 + rnd() * (R.r1[1] - R.r1[0] - 60); if (inCanal(a, r, 25) || busy(a, r) || Math.abs(r - 1126) < 34) continue; const [x, z] = at(r, a); house(x, z, -a + (rnd() - .5) * .3, 13.2, pick()); }
  for (let i = 0; i < 700; i++) { const outer = rnd() < .5, a = rnd() * TAU, r = outer ? 1905 + rnd() * 150 : 1400 + rnd() * 160; if (inCanal(a, r, 25)) continue; if (!outer && angD(a, Math.round((a - Math.PI / 12) / (TAU / 12)) * (TAU / 12) + Math.PI / 12) < 80 / r && Math.abs(r - 1480) < 60) continue;
    const [x, z] = at(r, a); house(x, z, -a + (rnd() - .5) * .3, 11.2, pick()); }
  for (let i = 0; i < 520; i++) { const a = rnd() * TAU, r = rnd() < .55 ? 760 + rnd() * 380 : (rnd() < .5 ? 1400 + rnd() * 170 : 1905 + rnd() * 150); if (inCanal(a, r, 20)) continue; const y = r < 1200 ? 13.2 : 11.2, [x, z] = at(r, a), h = 12 + rnd() * 18;
    if (rnd() < .5) { put('trunk', M(cyl(.8, 1.1, 3, 5), x, y, z)); const c = new T.CylinderGeometry(.6, 3.4, h * 1.1, 7, 3); const p = c.attributes.position; for (let q = 0; q < p.count; q++) { const v = (p.getY(q) / (h * 1.1)) + .5; const s2 = Math.sin(Math.PI * Math.min(1, v * 1.25)) + .25; p.setX(q, p.getX(q) * s2 / 1.25 * 1.4); p.setZ(q, p.getZ(q) * s2 / 1.25 * 1.4); } c.computeVertexNormals(); put('leaf2', M(c.translate(0, h * .55 + 2, 0), x, y, z)); }
    else { put('trunk', M(cyl(1, 1.6, h * .45, 5), x, y, z)); for (let b = 0; b < 3; b++) { const rr = 4 + rnd() * 3.5, g = new T.IcosahedronGeometry(rr, 0); g.scale(1, .78, 1); put(rnd() < .4 ? 'leaf2' : 'leaf', M(g, x + (rnd() - .5) * 6, y + h * .45 + rr * .5 + b * 2.5, z + (rnd() - .5) * 6)); } } }

  // ================= PUENTES =================
  const bridge = (cx, cz, rot, L, Wd, y) => { const Rm = new T.Matrix4().makeRotationY(rot).setPosition(cx, 0, cz), add = (m, g) => put(m, g.applyMatrix4(Rm));
    add('marble', box(L, 6, Wd).translate(0, y, 0)); add('trim', box(L, 1.2, 1.5).translate(0, y + 6, Wd / 2)); add('trim', box(L, 1.2, 1.5).translate(0, y + 6, -Wd / 2));
    const n = Math.max(2, Math.round(L / 60)); for (let k = 0; k < n; k++) { const arc = new T.TorusGeometry(L / n / 2, 4, 4, 10, Math.PI); arc.translate(-L / 2 + L / n / 2 + k * L / n, y - L / n / 2 + 1, 0); add('marble', arc.clone().translate(0, 0, Wd / 2)); add('marble', arc.translate(0, 0, -Wd / 2)); add('stone', box(8, y, Wd).translate(-L / 2 + k * L / n, 0, 0)); }
    for (const ex of [-1, 1]) for (const sd of [-1, 1]) { const sx = ex * (L / 2 + 6), sz = sd * (Wd / 2 - 3); add('marble', box(7, 8, 7).translate(sx, y + 6, sz)); add('trim', box(7.6, .7, 7.6).translate(sx, y + 14, sz)); add('bronze', cyl(1.6, 2.4, 9, 7).translate(sx, y + 14.7, sz)); add('bronze', new T.SphereGeometry(1.7, 8, 6).translate(sx, y + 25.4, sz)); add('bronze', box(1, 6, 1).translate(sx + 1.8, y + 20, sz).applyMatrix4(new T.Matrix4())); }
    for (let k = 0; k <= n * 2; k++) for (const sd of [-1, 1]) { add('bronze', cyl(.8, 1, 9, 4).translate(-L / 2 + k * L / (n * 2), y + 6, sd * (Wd / 2))); add('lamp', new T.OctahedronGeometry(2.3, 0).translate(-L / 2 + k * L / (n * 2), y + 16, sd * (Wd / 2))); } };
  CAN.forEach(c => { [[R.w1[0] - 10, R.w1[1] + 10, 18], [R.w2[0] - 10, R.w2[1] + 10, 14]].forEach(([r0, r1, y]) => { const [x, z] = at((r0 + r1) / 2, c); bridge(x, z, c, r1 - r0, 50, y); });
    [[950, 14], [1290, 0], [1700, 12]].forEach(([r, y]) => { if (!y) return; const [x, z] = at(r, c); bridge(x, z, c + Math.PI / 2, GAPW + 40, 34, y + 8); }); });

  // ================= ACRÓPOLIS y TEMPLO-ALMACÉN DE DATOS =================
  [[470, 18, 26], [370, 44, 26], [280, 70, 26]].forEach(([r, y, h]) => { put('marble', M(cyl(r, r + 8, h, 128), 0, y, 0)); put('trim', M(cyl(r + 1, r + 1, 2, 128), 0, y + h, 0)); lampsOnCircle(r - 6, y + h, 45); });
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU, [x, z] = at(452, a); column(put, x, 44, z, 2.6, 22); }
  CAN.concat(CAN.map(c => c + Math.PI / 4)).forEach((c, ci) => { for (let k = 0; k < 3; k++) { const r = [470, 370, 280][k]; for (let st = 0; st < 6; st++) { const [x, z] = at(r + 30 - st * 6, c); put('marble', M(box(70 - (ci > 3 ? 30 : 0), 18 + k * 26 + st * 4.3 - 18 - k * 26 + 4, 12), x, 18 + k * 26, z, -c + Math.PI / 2)); } } });
  const yT = 96;
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, [x, z] = at(210, a); column(put, x, yT, z, 7.6, 100); }
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
    win: S({ color: 0xffd58a, emissive: 0xffc46a, side: T.DoubleSide }), winOff: S({ color: 0x1a2236, roughness: .15, metalness: .6, side: T.DoubleSide }), lamp: S({ color: 0xfff1c9, emissive: 0xffd27a }),
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
