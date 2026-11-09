// Orqa fondagi 3D sahna: sakura shoxlari, gullar, to'kilayotgan gulbarglar va tuman
import * as THREE from 'three';

const PINK_DEEP = new THREE.Color(0xd97a99);
const PINK = new THREE.Color(0xf2b4c7);
const PINK_PALE = new THREE.Color(0xfde9ef);
const rand = (a, b) => a + Math.random() * (b - a);

// --- Bitta gulbarg: uchida kertigi bor, chetlari ichkariga egilgan ---
function makePetalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-0.42, 0.22, -0.5, 0.78, -0.16, 1.02);
  s.quadraticCurveTo(-0.06, 1.06, 0, 0.93); // kertik
  s.quadraticCurveTo(0.06, 1.06, 0.16, 1.02);
  s.bezierCurveTo(0.5, 0.78, 0.42, 0.22, 0, 0);
  const g = new THREE.ShapeGeometry(s, 14);
  const pos = g.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, x * x * 0.7 + y * y * 0.18); // kosachasimon egilish
    // asosi to'q pushti, uchi oqish
    if (y < 0.35) c.copy(PINK_DEEP).lerp(PINK, y / 0.35);
    else c.copy(PINK).lerp(PINK_PALE, (y - 0.35) / 0.7);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function init() {
  const canvas = document.getElementById('bg3d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 600;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a1d24, 12, 36); // pushti-binafsha tuman
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 16);

  // Yorug'lik: tumanli krem nur + pushti porlash
  scene.add(new THREE.HemisphereLight(0xfff3ee, 0x2a1a20, 1.3));
  const key = new THREE.DirectionalLight(0xfff1e0, 1.8);
  key.position.set(-8, 10, 8);
  scene.add(key);
  const glow = new THREE.PointLight(0xf2b4c7, 50, 30);
  glow.position.set(2, 0, 8);
  scene.add(glow);

  // --- Materiallar va umumiy geometriyalar ---
  const petalGeo = makePetalGeometry();
  const petalMat = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.55,
    emissive: 0x4a1d2c, emissiveIntensity: 0.45,
  });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x1d1517, roughness: 0.95 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xb8506c, roughness: 0.6, emissive: 0x3a1020 });
  const stamenMat = new THREE.MeshStandardMaterial({ color: 0xe9c9c9, roughness: 0.6 });
  const pollenMat = new THREE.MeshStandardMaterial({ color: 0xf3cf8a, emissive: 0x5a3a10, roughness: 0.5 });
  const budMat = new THREE.MeshStandardMaterial({ color: 0xe48eab, roughness: 0.5, emissive: 0x3a1020 });
  const centerGeo = new THREE.SphereGeometry(0.11, 16, 16);
  const stamenGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.34, 4);
  stamenGeo.translate(0, 0.17, 0);
  const pollenGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const budGeo = new THREE.SphereGeometry(0.13, 12, 12);
  budGeo.scale(1, 1.4, 1);

  // --- Bitta sakura guli (5 gulbarg + changchilar) ---
  const flowerProto = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(petalGeo, petalMat);
    p.rotation.x = 0.38;
    p.position.y = 0.05;
    pivot.add(p);
    flowerProto.add(pivot);
  }
  flowerProto.add(new THREE.Mesh(centerGeo, centerMat));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const st = new THREE.Group();
    st.rotation.z = a;
    st.rotation.x = 0.7;
    st.add(new THREE.Mesh(stamenGeo, stamenMat));
    const pol = new THREE.Mesh(pollenGeo, pollenMat);
    pol.position.y = 0.34;
    st.add(pol);
    flowerProto.add(st);
  }
  function flower(scale) {
    const f = flowerProto.clone();
    f.scale.setScalar(scale);
    return f;
  }

  // --- Shoxlar (rekursiv o'sadi, uchlarida gullar) ---
  const branches = [];
  function grow(group, start, dir, len, rad, depth) {
    const pts = [start.clone()];
    const d = dir.clone().normalize();
    for (let i = 1; i <= 4; i++) {
      d.applyAxisAngle(new THREE.Vector3(0, 0, 1), rand(-0.22, 0.22));
      d.z += rand(-0.06, 0.06);
      pts.push(pts[i - 1].clone().addScaledVector(d.clone().normalize(), len / 4));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, rad, 7), barkMat));
    const end = pts[4];

    if (depth < 3) {
      const kids = depth === 0 ? 3 : 2;
      for (let k = 0; k < kids; k++) {
        const t = rand(0.4, 1);
        const from = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const side = k % 2 ? 1 : -1;
        const nd = tan.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), side * rand(0.35, 0.9));
        grow(group, from, nd, len * rand(0.45, 0.65), rad * 0.6, depth + 1);
      }
    }
    // Gullar: uchida to'p-to'p, yo'l bo'ylab siyrak
    const clusters = depth >= 2 ? 5 : depth === 1 ? 2 : 0;
    for (let i = 0; i < clusters; i++) {
      const p = i < 3 ? end.clone() : curve.getPoint(rand(0.3, 0.9));
      const f = flower(rand(0.32, 0.55));
      f.position.copy(p).add(new THREE.Vector3(rand(-0.35, 0.35), rand(-0.35, 0.35), rand(-0.2, 0.3)));
      f.lookAt(camera.position);
      f.rotateX(rand(-0.7, 0.7));
      f.rotateY(rand(-0.7, 0.7));
      f.rotateZ(rand(0, Math.PI * 2));
      group.add(f);
    }
    // G'unchalar
    for (let i = 0; i < (depth >= 2 ? 2 : 0); i++) {
      const b = new THREE.Mesh(budGeo, budMat);
      b.position.copy(curve.getPoint(rand(0.5, 1))).add(new THREE.Vector3(rand(-0.15, 0.15), rand(-0.15, 0.15), 0.05));
      b.rotation.z = rand(-1, 1);
      b.scale.setScalar(rand(0.6, 1));
      group.add(b);
    }
  }

  function viewHalf(z) {
    const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z);
    return { h, w: h * camera.aspect };
  }
  function buildBranches() {
    for (const b of branches) scene.remove(b.group);
    branches.length = 0;
    const specs = [
      { z: -3, side: -1, y: 0.55, dir: new THREE.Vector3(1, -0.3, 0.05), lenK: 0.95, rad: 0.17 },
      { z: -2, side: 1, y: -0.62, dir: new THREE.Vector3(-1, 0.35, 0.05), lenK: 0.9, rad: 0.15 },
      { z: -9, side: 1, y: 0.85, dir: new THREE.Vector3(-1, -0.45, 0), lenK: 0.7, rad: 0.12 },
    ];
    if (small) specs.pop();
    for (const s of specs) {
      const v = viewHalf(s.z);
      const group = new THREE.Group();
      grow(group, new THREE.Vector3(s.side * (v.w + 1.2), v.h * s.y, s.z), s.dir, Math.max(v.w * s.lenK, 4.5), s.rad, 0);
      scene.add(group);
      branches.push({ group, phase: Math.random() * 6 });
    }
  }
  buildBranches();

  // --- Erkin suzib yuruvchi gullar ---
  const floaters = [];
  for (let i = 0; i < (small ? 5 : 9); i++) {
    const f = flower(rand(0.45, 0.85));
    f.position.set(rand(-11, 11), rand(-7, 7), rand(-12, 2));
    f.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    f.userData = { base: f.position.clone(), phase: rand(0, 6), spin: new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.2, 0.2)) };
    scene.add(f);
    floaters.push(f);
  }

  // --- To'kilayotgan gulbarglar (InstancedMesh — tez ishlaydi) ---
  const N = reduce ? 40 : small ? 110 : 230;
  const fall = new THREE.InstancedMesh(petalGeo, petalMat, N);
  const P = [];
  const dummy = new THREE.Object3D();
  function resetPetal(p, top) {
    p.z = rand(-14, 6);
    const vv = viewHalf(p.z);
    p.x = rand(-vv.w - 2, vv.w + 2);
    p.y = top ? vv.h + rand(0.5, 3) : rand(-vv.h, vv.h);
    p.vy = rand(0.5, 1.1);
    p.sway = rand(0.3, 0.9);
    p.f = rand(0.6, 1.4);
    p.ph = rand(0, 6);
    p.s = rand(0.12, 0.24);
    p.rot = new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6));
    p.rs = new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-1, 1));
  }
  for (let i = 0; i < N; i++) { const p = {}; resetPetal(p, false); P.push(p); }
  scene.add(fall);

  // --- Parallaks ---
  const target = new THREE.Vector2();
  addEventListener('pointermove', (e) => target.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5));

  // Qadam o'zgarganda shamol esadi
  let wind = 0;
  window.kick3D = () => { wind = 4; };

  // --- Muvaffaqiyat: gulbarglar portlashi ---
  const burst = [];
  window.burst3D = () => {
    if (reduce) return;
    for (let i = 0; i < 110; i++) {
      const m = new THREE.Mesh(petalGeo, petalMat.clone());
      m.material.transparent = true;
      m.scale.setScalar(rand(0.15, 0.3));
      m.position.set(rand(-1.5, 1.5), rand(1, 2.5), 5);
      const a = rand(0, Math.PI * 2), sp = rand(6, 15);
      m.userData = {
        v: new THREE.Vector3(Math.cos(a) * sp * 1.3, Math.sin(a) * sp * 0.7 + 5, rand(-2, 4)),
        r: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
        life: 0, ph: rand(0, 6),
      };
      scene.add(m);
      burst.push(m);
    }
  };

  let resizeT;
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', () => {
    resize();
    clearTimeout(resizeT);
    resizeT = setTimeout(buildBranches, 300); // shoxlar ekran chetiga moslashadi
  });
  resize();

  let last = performance.now(), t = 0;
  function frame() {
    const nowT = performance.now();
    const dt = Math.min((nowT - last) / 1000, 0.05);
    last = nowT;
    const k = reduce ? 0.2 : 1;
    t += dt * k;
    wind *= 0.97;

    camera.position.x += (target.x * 2.2 - camera.position.x) * 0.04;
    camera.position.y += (-target.y * 1.5 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    // shoxlar shamolda tebranadi
    for (const b of branches) {
      b.group.rotation.z = Math.sin(t * 0.5 + b.phase) * 0.012 + wind * 0.004;
      b.group.rotation.x = Math.sin(t * 0.35 + b.phase) * 0.01;
    }
    for (const f of floaters) {
      const u = f.userData;
      f.rotation.x += u.spin.x * dt * k;
      f.rotation.y += u.spin.y * dt * k;
      f.rotation.z += u.spin.z * dt * k;
      f.position.y = u.base.y + Math.sin(t * 0.5 + u.phase) * 0.6;
      f.position.x = u.base.x + Math.cos(t * 0.35 + u.phase) * 0.4 + wind * 0.15;
    }
    for (let i = 0; i < N; i++) {
      const p = P[i];
      p.y -= p.vy * dt * k;
      p.x += (Math.sin(t * p.f + p.ph) * p.sway + 0.25 + wind) * dt * k;
      p.rot.x += p.rs.x * dt * k;
      p.rot.y += p.rs.y * dt * k;
      p.rot.z += p.rs.z * dt * k;
      const v = viewHalf(p.z);
      if (p.y < -v.h - 2 || p.x > v.w + 4) resetPetal(p, true);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      fall.setMatrixAt(i, dummy.matrix);
    }
    fall.instanceMatrix.needsUpdate = true;

    for (let i = burst.length - 1; i >= 0; i--) {
      const m = burst[i], u = m.userData;
      u.life += dt;
      u.v.y -= 4 * dt;
      u.v.multiplyScalar(0.965);
      u.v.x += Math.sin(u.life * 3 + u.ph) * 0.08;
      m.position.addScaledVector(u.v, dt);
      m.rotation.x += u.r.x * dt;
      m.rotation.y += u.r.y * dt;
      m.material.opacity = Math.max(0, 1 - u.life / 3.5);
      if (u.life > 3.5) { scene.remove(m); m.material.dispose(); burst.splice(i, 1); }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
  document.documentElement.classList.add('has3d');
}

init();
