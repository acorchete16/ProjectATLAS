// Generador del modelo 3D de Atlántida (data/atlantis.glb). Se ejecuta en un navegador con three r128 + BufferGeometryUtils + GLTFExporter: buildAtlantis() devuelve el .glb en base64.
// Genera Atlántida como modelo glTF (metros, Y arriba). Se ejecuta en el navegador con three r128.
window.buildAtlantis = function () {
  const T = THREE, BU = T.BufferGeometryUtils;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bins = {}; // material -> [geometries]
  const put = (mat, g) => { (bins[mat] = bins[mat] || []).push(g.index ? g.toNonIndexed() : g); };
  const M = (g, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => { g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(sx, sy, sz))); return g; };
  const box = (w, h, d) => new T.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, s = 10) => new T.CylinderGeometry(rt, rb, h, s, 1).translate(0, h / 2, 0);
  const ring = (r0, r1, h, a0 = 0, a1 = Math.PI * 2, seg = 96) => { // anillo extruido (sector)
    const sh = new T.Shape(); const n = Math.max(8, Math.round(seg * (a1 - a0) / (Math.PI * 2)));
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const p = [Math.cos(a) * r1, Math.sin(a) * r1]; i ? sh.lineTo(...p) : sh.moveTo(...p); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); }
    const g = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); return g; };
  const at = (r, a) => [Math.cos(a) * r, -Math.sin(a) * r]; // (x, z) para un radio y ángulo
  const CAN = [0, Math.PI / 2, Math.PI, Math.PI * 1.5], GAP = 0.05;
  const inCanal = (a, extra = 0) => CAN.some(c => { let d = Math.abs(((a - c) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return d < GAP + extra; });
  const segs = (r0, r1, h, mat, y = 0) => CAN.forEach((c, i) => { const a0 = c + GAP, a1 = (CAN[i + 1] ?? CAN[0] + Math.PI * 2) - GAP; put(mat, ring(r0, r1, h, a0, a1, 160).translate(0, y, 0)); });

  // ---------- TERRENO: anillos concéntricos de tierra (Platón) ----------
  segs(1900, 2060, 14, 'stone'); segs(1360, 1880, 10, 'stone'); segs(720, 1160, 12, 'stone');
  put('stone', ring(0, 520, 18, 0, Math.PI * 2, 128));
  segs(1380, 1860, 1.5, 'grass', 10); segs(740, 1140, 1.5, 'grass', 12); // jardines
  // paseos de mármol en el borde de cada anillo
  [[1360, 1380, 10], [1860, 1880, 10], [720, 740, 12], [1140, 1160, 12]].forEach(([a, b, y]) => segs(a, b, 2, 'marble', y));

  // ---------- MURALLA EXTERIOR DE ORICALCO con torres y puertas ----------
  segs(2010, 2045, 60, 'ori', 14);
  segs(2006, 2049, 6, 'trim', 74); // cornisa luminosa
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; if (inCanal(a, .02)) continue; const [x, z] = at(2028, a);
    put('ori', M(cyl(26, 30, 110, 12), x, 14, z)); put('roof', M(cyl(0, 32, 40, 12), x, 124, z)); put('lamp', M(cyl(4, 4, 6, 6), x, 164, z)); }
  CAN.forEach(c => [-1, 1].forEach(sd => { const a = c + sd * (GAP + .012); const [x, z] = at(2028, a); put('ori', M(cyl(40, 46, 150, 12), x, 14, z)); put('trim', M(cyl(0, 48, 60, 12), x, 164, z)); }));

  // ---------- TEMPLO DE COLUMNAS (tipo Partenón) ----------
  const temple = (cx, cz, rot, L, W, H, colR) => {
    const R = new T.Matrix4().makeRotationY(rot).setPosition(cx, 0, cz); const add = (mat, g) => put(mat, g.applyMatrix4(R));
    for (let k = 0; k < 3; k++) add('marble', box(L + 24 - k * 8, 4, W + 24 - k * 8).translate(0, 12 + k * 4, 0)); // escalinata
    const y0 = 24, nl = Math.round(L / (colR * 4.2)), nw = Math.round(W / (colR * 4.2));
    for (let i = 0; i <= nl; i++) for (const sz of [-1, 1]) { const x = -L / 2 + i * L / nl; add('marble', cyl(colR * .85, colR, H, 10).translate(x, y0, sz * W / 2)); add('marble', box(colR * 2.6, colR * .8, colR * 2.6).translate(x, y0 + H, sz * W / 2)); }
    for (let j = 1; j < nw; j++) for (const sx of [-1, 1]) { const z = -W / 2 + j * W / nw; add('marble', cyl(colR * .85, colR, H, 10).translate(sx * L / 2, y0, z)); }
    add('stone', box(L * .82, H * .9, W * .7).translate(0, y0, 0)); // cella
    add('marble', box(L + colR * 3, colR * 2.2, W + colR * 3).translate(0, y0 + H + colR * .8, 0)); // entablamento
    add('trim', box(L + colR * 3.2, 1.6, W + colR * 3.2).translate(0, y0 + H + colR * .8 + colR * 2.2, 0));
    { const hw = W / 2 + colR * 1.8, hr = W * .22, sh = new T.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, hr); sh.closePath();
      const roof = new T.ExtrudeGeometry(sh, { depth: L + colR * 3.4, bevelEnabled: false }); roof.translate(0, 0, -(L + colR * 3.4) / 2); roof.rotateY(Math.PI / 2);
      add('roof', roof.translate(0, y0 + H + colR * 3.2 + 1.6, 0)); }
    for (let i = 0; i < 4; i++) add('lamp', cyl(2.5, 2.5, 5, 6).translate((i < 2 ? -1 : 1) * (L / 2 + 10), 24, (i % 2 ? -1 : 1) * (W / 2 + 10)));
  };
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, [x, z] = at(940, a); temple(x, z, a + Math.PI / 2, 150, 72, 46, 4.2); }

  // ---------- BARRIOS: casas con tejado, faroles y árboles ----------
  const house = (x, z, rot, y0, mat) => { const w = 14 + rnd() * 16, d = 12 + rnd() * 12, h = 10 + rnd() * 18, R = new T.Matrix4().makeRotationY(rot).setPosition(x, y0, z);
    put(mat, box(w, h, d).applyMatrix4(R)); const rf = new T.ConeGeometry(Math.max(w, d) * .72, 8 + rnd() * 6, 4); rf.rotateY(Math.PI / 4); rf.scale(w / Math.max(w, d), 1, d / Math.max(w, d)); put(rnd()<.3?'roof2':'roof', rf.translate(0, h + 5, 0).applyMatrix4(R));
    if (rnd() < .45) put('win', box(w * .5, 2.2, .6).translate(0, h * .55, d / 2 + .3).applyMatrix4(R)); };
  const district = (r0, r1, y0, n, avoid) => { for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0); if (inCanal(a, .03) || (avoid && avoid(a, r))) continue; const [x, z] = at(r, a); house(x, z, -a + (rnd() - .5) * .3, y0, ['marble','plaster','plaster2','plaster3'][Math.floor(rnd()*4)]); } };
  district(760, 1120, 13.5, 420, (a, r) => { for (let i = 0; i < 8; i++) { const ta = i / 8 * Math.PI * 2 + Math.PI / 8; let d = Math.abs(((a - ta) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < .14 && r > 840 && r < 1050) return true; } return false; });
  district(1400, 1840, 11.5, 760, (a, r) => r > 1560 && r < 1700); // deja libre el hipódromo
  for (let i = 0; i < 380; i++) { const ring2 = rnd() < .6, a = rnd() * Math.PI * 2, r = ring2 ? 1400 + rnd() * 440 : 760 + rnd() * 360; if (inCanal(a, .03)) continue; const [x, z] = at(r, a), h = 14 + rnd() * 16;
    put('trunk', M(cyl(1.4, 2, h * .4, 5), x, ring2 ? 11.5 : 13.5, z)); put('leaf', M(new T.ConeGeometry(7 + rnd() * 4, h, 7).translate(0, h * .4 + h / 2, 0), x, ring2 ? 11.5 : 13.5, z)); }
  // hipódromo (Platón cuenta que el anillo exterior tenía una pista de carreras)
  segs(1575, 1595, 16, 'marble', 10); segs(1665, 1685, 16, 'marble', 10); segs(1595, 1665, .8, 'sand', 11);
  for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; if (inCanal(a, .01)) continue; [1585, 1675].forEach(r => { const [x, z] = at(r, a); put('lamp', M(cyl(2.2, 2.2, 4, 6), x, 26, z)); }); }

  // ---------- PUENTES sobre los anillos de agua y en los canales ----------
  CAN.forEach(c => { [[520, 720], [1160, 1360], [1880, 1900]].forEach(([r0, r1]) => { const L = r1 - r0, [x, z] = at((r0 + r1) / 2, c), R = new T.Matrix4().makeRotationY(-c).setPosition(x, 0, z);
      put('marble', box(L + 20, 6, 46).translate(0, 12, 0).applyMatrix4(R));
      for (let k = 0; k < 3; k++) { const arc = new T.TorusGeometry(L / 6, 4, 6, 16, Math.PI); arc.translate(-L / 2 + L / 6 + k * L / 3, 4, 0); put('marble', arc.clone().translate(0, 0, 21).applyMatrix4(R)); put('marble', arc.translate(0, 0, -21).applyMatrix4(R)); }
      for (let k = 0; k <= 6; k++) for (const sd of [-1, 1]) put('lamp', box(3, 7, 3).translate(-L / 2 + k * L / 6, 18, sd * 22).applyMatrix4(R)); }); });

  // ---------- ACRÓPOLIS: terrazas, escalinatas y el TEMPLO-ALMACÉN DE DATOS ----------
  [[460, 18, 26], [360, 44, 26], [270, 70, 26]].forEach(([r, y, h]) => { put('marble', M(cyl(r, r + 8, h, 96), 0, y, 0)); put('trim', M(cyl(r + 1, r + 1, 1.5, 96), 0, y + h, 0)); });
  CAN.forEach(c => { for (let k = 0; k < 3; k++) { const r = [460, 360, 270][k], [x, z] = at(r + 20, c); put('marble', M(box(44, 26, 70), x, 18 + k * 26, z, -c)); } });
  const yT = 96;
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, [x, z] = at(200, a); put('marble', M(cyl(7, 8, 90, 12), x, yT, z)); put('ori', M(box(16, 5, 16), x, yT + 90, z)); }
  put('marble', M(cyl(210, 210, 10, 96), 0, yT + 95, 0)); put('trim', M(cyl(211, 211, 2.5, 96), 0, yT + 105, 0));
  const dome = new T.SphereGeometry(205, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, .62, 1); put('ori', dome.translate(0, yT + 105, 0));
  for (let i = 0; i < 24; i++) { const rib = new T.TorusGeometry(205, 2.2, 5, 48, Math.PI / 2); rib.rotateZ(Math.PI / 2 * 0); rib.scale(1, .62, 1); rib.rotateY(i / 24 * Math.PI * 2); put('trim', rib.translate(0, yT + 105, 0)); }
  // núcleo de datos: torres de servidores dentro de la columnata
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, [x, z] = at(140, a); put('server', M(box(16, 70, 26), x, yT, z, -a)); for (let k = 0; k < 6; k++) put('core', M(box(16.6, 2.2, 26.6), x, yT + 8 + k * 10, z, -a)); }
  put('core', M(cyl(46, 52, 95, 32), 0, yT, 0));
  // aguja de cristal que atraviesa la cúpula y anillos de datos flotando
  put('core', M(new T.ConeGeometry(30, 330, 8).translate(0, 165, 0), 0, yT + 200, 0));
  put('core', M(new T.OctahedronGeometry(38, 0), 0, yT + 560, 0));
  [[262, 6, 250], [195, 5, 330], [125, 4, 410]].forEach(([r, t, y]) => { const tor = new T.TorusGeometry(r, t, 6, 96); tor.rotateX(Math.PI / 2); put('core', tor.translate(0, y, 0)); });

  // ---------- TRIDENTE DE POSEIDÓN en la bocana del canal sur y obeliscos ----------
  { const [x, z] = at(2200, Math.PI * 1.5); put('ori', M(cyl(9, 12, 240, 10), x, 0, z)); put('ori', M(box(110, 12, 12), x, 240, z)); [-50, 0, 50].forEach(dx => { put('ori', M(cyl(0, 9, 90, 8), x + dx, 252, z)); put('core', M(new T.OctahedronGeometry(7, 0), x + dx, 350, z)); }); }
  CAN.forEach(c => [-1, 1].forEach(sd => { const [x, z] = at(1270, c + sd * .1); put('marble', M(cyl(4, 9, 120, 4), x, 0, z, Math.PI / 4)); put('trim', M(cyl(0, 6, 16, 4), x, 120, z, Math.PI / 4)); }));
  // barcos en el anillo de agua exterior
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2; if (inCanal(a, .05)) continue; const [x, z] = at(1270 + (rnd() - .5) * 120, a), R = new T.Matrix4().makeRotationY(-a + Math.PI / 2).setPosition(x, 0, z);
    put('wood', new T.CylinderGeometry(6, 3, 60, 6).rotateZ(Math.PI / 2).scale(1, .55, 1).translate(0, 3, 0).applyMatrix4(R)); put('wood', cyl(.8, .8, 34, 5).translate(0, 4, 0).applyMatrix4(R)); put('sail', box(22, 22, .6).translate(0, 12, 0).applyMatrix4(R)); }

  // ---------- MATERIALES PBR ----------
  const MAT = {
    stone: new T.MeshStandardMaterial({ color: 0x2b3150, roughness: .95, metalness: 0 }),
    grass: new T.MeshStandardMaterial({ color: 0x1f4a3c, roughness: 1 }),
    sand: new T.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }),
    marble: new T.MeshStandardMaterial({ color: 0xe9e1cf, roughness: .45, metalness: 0 }),
    plaster: new T.MeshStandardMaterial({ color: 0xd8c7a6, roughness: .8 }),
    ori: new T.MeshStandardMaterial({ color: 0xc8743a, roughness: .32, metalness: .85, emissive: 0x3a1500 }),
    trim: new T.MeshStandardMaterial({ color: 0xffc070, roughness: .3, metalness: .6, emissive: 0xff9a3c }),
    roof: new T.MeshStandardMaterial({ color: 0x9c4a2c, roughness: .7 }),
    roof2: new T.MeshStandardMaterial({ color: 0x2f6f74, roughness: .5, metalness: .4 }),
    plaster2: new T.MeshStandardMaterial({ color: 0xc9b48f, roughness: .85 }),
    plaster3: new T.MeshStandardMaterial({ color: 0xa9b6c4, roughness: .8 }),
    win: new T.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffc46a }),
    lamp: new T.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd27a }),
    server: new T.MeshStandardMaterial({ color: 0x141c3a, roughness: .4, metalness: .6 }),
    core: new T.MeshStandardMaterial({ color: 0x9ff8ff, emissive: 0x35e0ff, roughness: .1, metalness: .2 }),
    trunk: new T.MeshStandardMaterial({ color: 0x4a3426, roughness: 1 }),
    leaf: new T.MeshStandardMaterial({ color: 0x2f6b4a, roughness: .9 }),
    wood: new T.MeshStandardMaterial({ color: 0x5a3b26, roughness: .9 }),
    sail: new T.MeshStandardMaterial({ color: 0xf2e8d5, roughness: .9, side: T.DoubleSide }),
  };
  const scene = new T.Scene(); let tris = 0;
  for (const [k, list] of Object.entries(bins)) {
    const clean = list.map(g => { const n = new T.BufferGeometry(); n.setAttribute('position', g.getAttribute('position')); n.setAttribute('normal', g.getAttribute('normal')); return n; });
    let g = BU.mergeBufferGeometries(clean); g = BU.mergeVertices(g, 0.01); tris += g.index.count / 3;
    const m = new T.Mesh(g, MAT[k]); m.name = k; scene.add(m);
  }
  return new Promise(res => new T.GLTFExporter().parse(scene, ab => { const u8 = new Uint8Array(ab); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); res({ b64: btoa(s), tris, bytes: u8.length }); }, { binary: true }));
};
