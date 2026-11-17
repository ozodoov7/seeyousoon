const $ = (id) => document.getElementById(id);
const state = { date: null, time: null, label: '' };
// Kimning sahifasi: seeyousoon.uz/<havola-nomi>
const SLUG = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, '')).toLowerCase();
const hostQ = () => (state.host ? `host=${encodeURIComponent(state.host)}` : '');
// Joylar uchun bir xil chiziq qalinligidagi ikonkalar (24×24)
const ICONS = {
  cinema: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l2.5-4.5h13L21 8M8 3.5 6.5 8M13 3.5 11.5 8M18 3.5 16.5 8"/><path d="m10.5 11.5 4 2.5-4 2.5z"/>',
  park: '<path d="M12 21v-5.5"/><path d="M12 15.5c-4.2 0-6.5-2.6-6.5-5.6 0-3.4 2.8-6.4 6.5-6.9 3.7.5 6.5 3.5 6.5 6.9 0 3-2.3 5.6-6.5 5.6Z"/><path d="M8.5 21h7M12 12l2.5-2.5M12 13.5 9.5 11"/>',
  cafe: '<path d="M4 9.5h12.5v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M16.5 11H18a2.5 2.5 0 0 1 0 5h-1.5"/><path d="M8 3.5c-.8 1 .8 1.8 0 3M12 3.5c-.8 1 .8 1.8 0 3"/>',
  restaurant: '<path d="M6 3v6.5a2 2 0 0 0 4 0V3M8 3v18"/><path d="M17.5 21V3c-2.3 1.2-3.5 4-3.5 7.5V13h3.5"/>',
  travel: '<path d="M21 4.5c-.6-.6-1.8-.5-2.6.3L15 8.2 6 5.5 4.3 7.2l7.2 4.3-3.3 3.3-2.7-.4-1.3 1.3 3.3 1.8 1.8 3.3 1.3-1.3-.4-2.7 3.3-3.3 4.3 7.2 1.7-1.7-2.7-9 3.4-3.4c.8-.8.9-2 .3-2.6Z"/>',
  nature: '<path d="m2.5 20 6.5-11 4 6.5 2.5-3.5 6 8Z"/><circle cx="17" cy="6" r="2.2"/>',
  walk: '<path d="M3 21h18M5 21V11h4v10M9 21V5h6v16M15 21v-8h4v8"/><path d="M11.5 8h1M11.5 11h1M11.5 14h1"/>',
  games: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  concert: '<path d="M9 18V5.5l11-2.5v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/><path d="M9 9.5l11-2.5"/>',
  other: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9Z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>',
};
// Tanlov qilinganda shu joydan gulbarglar uchadi (fx.js) va fondagi shoxlar shamolda tebranadi
const puff = (el) => { window.petalPuff && window.petalPuff(el); window.kick3D && window.kick3D(1.2); };

async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
  return data;
}

// Qadamlar orasida 3D aylanish
let current = 'step1';
function show(step) {
  if (step === current) return;
  const from = $(current), to = $(step);
  current = step;
  window.kick3D && window.kick3D();
  from.classList.remove('enter');
  from.classList.add('leave');
  setTimeout(() => {
    from.hidden = true;
    from.classList.remove('leave');
    to.hidden = false;
    to.classList.remove('enter');
    void to.offsetWidth; // animatsiyani qayta boshlash
    to.classList.add('enter');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (step === 'step3' && window.burst3D) setTimeout(window.burst3D, 450);
  }, 280);
}

// Karta sichqonchaga qarab 3D egiladi (faqat sichqonchali qurilmalarda)
(function tilt() {
  const card = $('card');
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  addEventListener('pointermove', (e) => {
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    const k = typing ? 0.25 : 1;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--ry', `${(x * 10 * k).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(-y * 8 * k).toFixed(2)}deg`);
    card.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    card.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    card.style.setProperty('--go', '1');
  });
  document.addEventListener('pointerleave', () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--go', '0');
  });
  // Kirish animatsiyasi tugagach egilish ishlashi uchun
  card.addEventListener('animationend', (e) => { if (e.target === card) card.style.animation = 'none'; });
})();

async function loadConfig() {
  const c = await api('/api/config' + (SLUG ? `?host=${encodeURIComponent(SLUG)}` : ''));
  state.host = c.host?.slug || null;
  // Havola egasi topilmasa yoki bosh sahifa bo'lsa — tanishtiruv
  if (!c.host) {
    const bot = c.botUsername ? `https://t.me/${c.botUsername}` : '#';
    if ($('ownerName')) $('ownerName').textContent = c.siteTitle || 'See you soon';
    if ($('ownerTitle')) $('ownerTitle').textContent = SLUG ? '' : 'Shaxsiy taklif havolangiz';
    if (SLUG) {
      $('landTitle').textContent = 'Bunday sahifa topilmadi 🤔';
      $('landText').textContent = `"${SLUG}" degan havola yo'q. Havolani yuborgan odamdan qayta so'rang — yoki o'zingizning havolangizni oling.`;
    }
    $('landBtn').href = bot;
    document.title = c.siteTitle || 'See you soon';
    $('landing').hidden = false;
    $('step1').hidden = true;
    return false;
  }
  // Avval savol: "Men bilan uchrashuvga chiqasizmi?" — kunlar orqada yuklanib turadi
  current = 'step0';
  $('step0').hidden = false;
  $('askPlea').textContent = `${c.host.name} javobingizni kutyapti 🌸`;
  // Sarlavha qismi xato bersa ham joylar baribir chiziladi
  try {
    const title = c.siteTitle || 'See you soon';
    if ($('ownerName')) $('ownerName').textContent = title;
    if ($('ownerTitle')) $('ownerTitle').textContent = c.siteSub || c.ownerTitle || '';
    // Davomiylik yozuvi hozircha yashirilgan (index.html da izohga olingan):
    // if ($('duration')) $('duration').textContent = `⏱ ${c.slotMinutes} daq`;
    document.title = title;
  } catch (e) { console.warn(e); }
  const box = $('places');
  if (!box || !Array.isArray(c.places)) return;
  box.innerHTML = '';
  c.places.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'place';
    b.style.setProperty('--i', i);
    // Ikonka: chizilgan SVG (noma'lum joy bo'lsa — serverdagi emoji)
    const ic = document.createElement('span');
    ic.className = 'pe';
    if (ICONS[p.id]) ic.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[p.id]}</svg>`;
    else ic.textContent = p.emoji;
    const nm = document.createElement('span');
    nm.textContent = p.name;
    b.append(ic, nm);
    b.title = p.vibe;
    b.onclick = () => {
      if (!b.classList.contains('on')) puff(b);
      box.querySelectorAll('.place').forEach((x) => x.classList.toggle('on', x === b));
      state.place = p.id;
      $('otherWrap').hidden = p.id !== 'other';
      if (p.id === 'other') $('form').placeText.focus();
    };
    box.appendChild(b);
  });
}

async function loadDays() {
  const days = await api('/api/days?' + hostQ());
  const box = $('days');
  box.innerHTML = '';
  let first = null;
  days.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = 'day';
    b.style.setProperty('--i', i);
    b.disabled = d.free === 0;
    b.innerHTML = `<small>${d.weekday}</small><b>${d.day}</b><small>${d.month}</small>`;
    b.title = d.free ? `${d.free} ta bo'sh vaqt` : 'Bo\'sh vaqt yo\'q';
    b.onclick = () => { if (!b.classList.contains('on')) puff(b); selectDay(d, b); };
    box.appendChild(b);
    if (!first && d.free) first = [d, b];
  });
  if (first) selectDay(...first);
  else $('slots').innerHTML = '<p class="muted">Yaqin kunlarda bo\'sh vaqt yo\'q.</p>';
}

async function selectDay(d, btn) {
  document.querySelectorAll('.day').forEach((x) => x.classList.toggle('on', x === btn));
  state.date = d.date;
  state.time = null;
  $('next').disabled = true;
  $('slots').innerHTML = '<p class="muted">Yuklanmoqda…</p>';
  const slots = await api('/api/slots?' + hostQ() + '&date=' + d.date);
  const box = $('slots');
  box.innerHTML = '';
  if (!slots.length) { box.innerHTML = '<p class="muted">Bu kunda bo\'sh vaqt yo\'q.</p>'; return; }
  slots.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'slot';
    b.style.setProperty('--i', i);
    b.textContent = s.time;
    b.disabled = !s.available;
    b.onclick = () => {
      if (!b.classList.contains('on')) puff(b);
      document.querySelectorAll('.slot').forEach((x) => x.classList.toggle('on', x === b));
      state.time = s.time;
      state.label = `📅 ${d.day}-${btn.querySelectorAll('small')[1].textContent}, ${btn.querySelector('small').textContent} · 🕐 ${s.time}`;
      $('next').disabled = false;
    };
    box.appendChild(b);
  });
}

$('next').onclick = () => { $('chosen').textContent = state.label; show('step2'); };
$('back').onclick = () => show('step1');
$('again').onclick = async () => { show('step1'); await loadDays(); };

function collect() {
  const err = $('error');
  err.hidden = true;
  const body = Object.fromEntries(new FormData($('form')).entries());
  let msg = '';
  if (!state.place) msg = 'Uchrashuv joyini tanlang 📍';
  else if (state.place === 'other' && !body.placeText.trim()) msg = 'Joy nomini yozing ✍️';
  if (msg) { err.textContent = msg; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); return null; }
  return { ...body, host: state.host, place: state.place, date: state.date, time: state.time };
}
async function submit(btn, url, body, onOk) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Yuborilmoqda…';
  try {
    onOk(await api(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  } catch (ex) {
    $('error').textContent = ex.message;
    $('error').hidden = false;
    if (/band/.test(ex.message)) loadDays();
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
}

// Qoralama yaratiladi va darhol botga o'tiladi, u yerda tasdiqlanadi
$('sendTg').onclick = () => {
  const body = collect();
  if (!body) return;
  submit($('sendTg'), '/api/draft', body, (r) => {
    $('donePlace').textContent = r.place;
    $('doneWhen').textContent = r.when;
    $('tgLink').href = r.botLink;
    // Asosiy lahza: tugmadan gulbarg bo'roni, keyin Telegramga o'tiladi
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.petalStorm) window.petalStorm($('sendTg'));
    window.kick3D && window.kick3D(6);
    setTimeout(() => { location.href = r.botLink; }, reduce ? 0 : 650);
    // Agar qurilma sahifani ochmasa — zaxira tugma ko'rinadi
    setTimeout(() => { if (!document.hidden) show('step3'); }, 2500);
  });
};

$('form').onsubmit = (e) => e.preventDefault();

// ---- Savol: "Yo'q" qochadi, "Ha" kattalashadi; bir necha urinishdan keyin faqat "Ha" qoladi ----
(function ask() {
  const yes = $('yes'), no = $('no'), plea = $('askPlea');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LABELS = ['Yo\'q', 'Aniqmi?', 'Rostdanmi?', 'Yo\'q…', 'Iltimos 🥺', '🥺'];
  const PLEAS = ['Ishonchingiz komilmi? 🥺', 'Yana bir o\'ylab ko\'ring 🙏', 'Tugma qochib ketdi-ku 😅',
    '«Ha» tugmasi kattalashyapti, sezdingizmi?', 'Shirinlik mendan 🍰', 'Oxirgi imkoniyat!'];
  const MAX = 6;
  let count = 0, tx = 0, ty = 0, lastAt = 0;

  // Karta ichida, "Ha" tugmasi va hozirgi joydan uzoqroq tasodifiy nuqta
  function move() {
    const card = $('card').getBoundingClientRect();
    const r = no.getBoundingClientRect();
    const y = yes.getBoundingClientRect();
    const baseX = r.left - tx, baseY = r.top - ty;
    const pad = 14;
    for (let i = 0; i < 24; i++) {
      const x = card.left + pad + Math.random() * Math.max(0, card.width - r.width - pad * 2);
      const top = card.top + pad + Math.random() * Math.max(0, card.height - r.height - pad * 2);
      const hitsYes = x < y.right + 12 && x + r.width > y.left - 12 && top < y.bottom + 12 && top + r.height > y.top - 12;
      const tooClose = Math.hypot(x - r.left, top - r.top) < 90;
      if (!hitsYes && (!tooClose || i === 23)) { tx = x - baseX; ty = top - baseY; break; }
    }
    no.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotate(${(Math.random() * 16 - 8).toFixed(1)}deg)`;
  }

  function dodge(e) {
    if (e) e.preventDefault();
    const t = performance.now();
    if (t - lastAt < 220 || count >= MAX) return; // bir harakatda ikki marta sanalmasin
    lastAt = t;
    count++;
    // Telefonda kartadan chiqib ketmasin
    const maxGrow = innerWidth < 480 ? 1.3 : 1.7;
    yes.style.setProperty('--grow', Math.min(1 + count * ((maxGrow - 1) / MAX), maxGrow).toFixed(2));
    plea.textContent = PLEAS[Math.min(count - 1, PLEAS.length - 1)];
    window.kick3D && window.kick3D(2);
    if (count >= MAX) {
      no.classList.add('gone');
      no.tabIndex = -1;
      no.setAttribute('aria-hidden', 'true');
      plea.textContent = 'Endi faqat bitta javob qoldi 🌸';
      yes.focus({ preventScroll: true });
      return;
    }
    no.textContent = LABELS[Math.min(count, LABELS.length - 1)];
    move();
  }
  // Sichqoncha yaqinlashishi bilan qochadi; telefonda va klaviaturada — bosilganda
  no.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') dodge(); });
  no.addEventListener('click', dodge);

  // Sarlavha harflarga bo'linadi: kirishda so'zma-so'z tiniqlashadi, "Ha" da gulbarglarga sochiladi
  const title = $('askTitle');
  const chars = [];
  (function split() {
    const words = [];
    let wi = 0;
    for (const node of [...title.childNodes]) {
      const em = node.nodeType === 1;
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(' '); return; }
        const w = document.createElement('span');
        w.className = 'w';
        w.style.setProperty('--wi', wi++);
        for (const ch of part) {
          const c = document.createElement('span');
          c.className = 'ch';
          c.textContent = ch;
          w.append(c);
          chars.push(c);
        }
        words.push(w);
        frag.append(w);
      });
      if (em) { node.textContent = ''; node.append(frag); } else node.replaceWith(frag);
    }
    title.setAttribute('aria-label', title.textContent);
    words.forEach((w) => w.setAttribute('aria-hidden', 'true'));
  })();

  function scatter() {
    if (reduce) return;
    chars.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const delay = i * 14;
      setTimeout(() => window.petalAt && window.petalAt(r.left + r.width / 2, r.top + r.height / 2, i % 3 === 0 ? 2 : 1), delay);
      c.animate([
        { transform: 'none', opacity: 1, filter: 'blur(0)' },
        { transform: `translate(${(Math.random() * 60 + 20).toFixed(0)}px, ${(-Math.random() * 70 - 30).toFixed(0)}px) rotate(${(Math.random() * 90 - 45).toFixed(0)}deg) scale(.6)`, opacity: 0, filter: 'blur(6px)' },
      ], { duration: 700, delay, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
    });
  }

  yes.addEventListener('click', () => {
    yes.disabled = true;
    scatter();
    window.petalStorm && window.petalStorm(yes);
    window.kick3D && window.kick3D(6);
    setTimeout(() => show('step1'), reduce ? 0 : 750);
  });
})();

loadConfig()
  .then((ok) => { if (ok !== false) return loadDays(); })
  .catch(() => { $('step1').hidden = false; $('slots').innerHTML = '<p class="error">Serverga ulanib bo\'lmadi</p>'; });
