const $ = (id) => document.getElementById(id);
const state = { date: null, time: null, label: '' };
// Kimning sahifasi: seeyousoon.uz/<havola-nomi>
const SLUG = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, '')).toLowerCase();
const hostQ = () => (state.host ? `host=${encodeURIComponent(state.host)}` : '');

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
  $('step1').hidden = false;
  // Sarlavha qismi xato bersa ham joylar baribir chiziladi
  try {
    const title = c.siteTitle || 'See you soon';
    if ($('ownerName')) $('ownerName').textContent = title;
    if ($('ownerTitle')) $('ownerTitle').textContent = c.siteSub || c.ownerTitle || '';
    // Davomiylik yozuvi hozircha yashirilgan (index.html da izohga olingan):
    // if ($('duration')) $('duration').textContent = `⏱ ${c.slotMinutes} daq`;
    if ($('avatar')) $('avatar').textContent = '🌸';
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
    b.innerHTML = `<span class="pe">${p.emoji}</span><span>${p.name}</span>`;
    b.title = p.vibe;
    b.onclick = () => {
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
    b.onclick = () => selectDay(d, b);
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
    location.href = r.botLink; // darhol o'tadi
    // Agar qurilma sahifani ochmasa — zaxira tugma ko'rinadi
    setTimeout(() => { if (!document.hidden) show('step3'); }, 2500);
  });
};

$('form').onsubmit = (e) => e.preventDefault();

loadConfig()
  .then((ok) => { if (ok !== false) return loadDays(); })
  .catch(() => { $('step1').hidden = false; $('slots').innerHTML = '<p class="error">Serverga ulanib bo\'lmadi</p>'; });
