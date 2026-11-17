// Kartaning ustidagi gulbarg effektlari: tanlov qilinganda bir hovuch gulbarg uchadi,
// taklif yuborilganda tugmadan gulbarg bo'roni chiqadi. 2D canvas, faqat zarra bor paytda ishlaydi.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.className = 'fx';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
  }
  size();
  addEventListener('resize', size);

  // Gulbarg ranglari: asosi to'q pushti, uchi oqish (3D fondagi bilan bir xil)
  const TONES = [['#d97a99', '#fde9ef'], ['#e48eab', '#fff3f6'], ['#f2b4c7', '#fffbea']];
  const rand = (a, b) => a + Math.random() * (b - a);
  const parts = [];
  let running = false, last = 0;

  function petal(p) {
    const s = p.size;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // Aylanib tushish: bir o'q bo'yicha siqiladi — gulbarg varaqlanayotgandek
    ctx.scale(1, Math.cos(p.flip) * 0.85 + 0.15 * Math.sign(Math.cos(p.flip) || 1));
    ctx.globalAlpha = p.alpha;
    const g = ctx.createLinearGradient(0, s * 0.5, 0, -s * 0.55);
    g.addColorStop(0, p.tone[0]);
    g.addColorStop(1, p.tone[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.5);
    ctx.bezierCurveTo(-s * 0.46, s * 0.28, -s * 0.5, -s * 0.3, -s * 0.16, -s * 0.52);
    ctx.quadraticCurveTo(-s * 0.06, -s * 0.56, 0, -s * 0.43);
    ctx.quadraticCurveTo(s * 0.06, -s * 0.56, s * 0.16, -s * 0.52);
    ctx.bezierCurveTo(s * 0.5, -s * 0.3, s * 0.46, s * 0.28, 0, s * 0.5);
    ctx.fill();
    ctx.restore();
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.04);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy = p.vy * (1 - 1.6 * dt) + p.grav * dt;
      p.x += (p.vx + Math.sin(p.life * p.swayF + p.ph) * p.sway) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      const k = p.life / p.max;
      p.alpha = k < 0.08 ? k / 0.08 : 1 - Math.pow(Math.max(0, (k - 0.55) / 0.45), 2);
      if (p.life >= p.max || p.y > H + 40) { parts.splice(i, 1); continue; }
      petal(p);
    }
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  function emit(x, y, n, power, spread) {
    if (reduce) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-spread, spread);
      const sp = power * rand(0.45, 1);
      parts.push({
        x: x + rand(-6, 6), y: y + rand(-4, 4),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        grav: rand(70, 120), sway: rand(14, 34), swayF: rand(2, 4.5), ph: rand(0, 6),
        rot: rand(0, Math.PI * 2), vr: rand(-4, 4), flip: rand(0, 6), vf: rand(3, 8),
        size: rand(9, 17), tone: TONES[(Math.random() * TONES.length) | 0],
        life: 0, max: rand(1.4, 2.4), alpha: 0,
      });
    }
    if (parts.length > 320) parts.splice(0, parts.length - 320);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }

  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  // Tanlov: elementning o'rtasidan bir hovuch gulbarg
  window.petalPuff = (el) => { const [x, y] = center(el); emit(x, y, 7, 260, 0.9); };
  // Nuqtadan bir-ikki gulbarg (sarlavha harflari sochilganda)
  window.petalAt = (x, y, n = 1) => emit(x, y, n, 180, 1.3);
  // Asosiy lahza: tugmadan ikki to'lqinli gulbarg bo'roni
  window.petalStorm = (el) => {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 5; i++) emit(r.left + (r.width * (i + 0.5)) / 5, r.top, 12, 620, 0.75);
    setTimeout(() => { const [x, y] = center(el); emit(x, y, 26, 480, 1.4); }, 140);
  };
})();
