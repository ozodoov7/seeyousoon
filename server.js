'use strict';
// Veb-server: sayt + API. Telegram bot bot.js da.
// Har bir foydalanuvchining shaxsiy sahifasi: seeyousoon.uz/<havola-nomi>
const path = require('path');
const express = require('express');
const L = require('./lib');
const bot = require('./bot');
const { CFG } = L;

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '20kb' }));
// HTML/JS/CSS har safar yangisi tekshirilsin — yangilanishdan keyin eski nusxa ko'rinmasin
const noCache = (res, file) => { if (/\.(html|js|css)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); };
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: noCache, index: false }));
// Three.js (3D animatsiyalar uchun) — CDN'siz, o'zimizdan beriladi
app.use('/vendor/three', express.static(path.dirname(require.resolve('three')), { maxAge: '7d' }));

// Baza tayyor bo'lishini kutish (birinchi so'rovda jadvallar yaratiladi) + admin matnlarini yangilash
const ready = async (req, res, next) => {
  try { await L.DB.init(); await L.loadSettings(); next(); } catch (e) {
    console.error('Baza xatosi:', e.message);
    res.status(503).json({ error: 'Server hozir band. Birozdan keyin urinib ko\'ring.' });
  }
};

// Telegram webhook (cPanel rejimi). Kalit bot tokenidan hosil qilinadi — tashqaridan topib bo'lmaydi.
// Avval xabar to'liq qayta ishlanadi, keyin javob qaytariladi — shared hosting javobdan keyin
// ilovani "muzlatib" qo'yishi mumkin, shunda bot javob yozishga ulgurmay qoladi.
app.post('/tg/:key', async (req, res) => {
  if (req.params.key !== bot.secret() || req.get('X-Telegram-Bot-Api-Secret-Token') !== bot.secret()) return res.sendStatus(403);
  await bot.handleUpdate(req.body || {});
  res.sendStatus(200);
});
// cPanel Cron har 5 daqiqada chaqiradi: eslatmalar + dasturni "uyg'oq" ushlash
app.get('/cron/:key', async (req, res) => {
  if (req.params.key !== bot.secret().slice(0, 16)) return res.sendStatus(403);
  await bot.checkReminders().catch((e) => console.error(e));
  res.json({ ok: true });
});

// Hosting tekshiruvi uchun
app.get('/health', async (req, res) => {
  let db = 'ok';
  try { await L.DB.init(); await L.q('SELECT 1'); } catch (e) { db = e.message; }
  res.json({ ok: true, db, bot: (await bot.ensureUsername()) || null, mode: bot.webhookMode() ? 'webhook' : 'polling', ...bot.stats });
});

// Kimning sahifasi: ?host=<havola-nomi>. Bo'sh bo'lsa — ROOT_SLUG (agar sozlangan bo'lsa)
async function hostFrom(req) {
  const slug = String(req.query.host || req.body?.host || '').toLowerCase() || CFG.rootSlug;
  return slug ? L.getHostBySlug(slug) : null;
}

app.get('/api/config', ready, async (req, res) => {
  const host = await hostFrom(req);
  const ism = host ? L.firstName(host.name) : '';
  res.json({
    siteTitle: L.txt('site_title', { ism }),
    siteSub: host ? L.txt('site_sub', { ism }) : '',
    host: host ? { slug: host.slug, name: ism } : null,
    botUsername: await bot.ensureUsername(),
    places: Object.entries(L.PLACES).map(([id, p]) => ({ id, emoji: p.emoji, name: L.pname(id), vibe: L.vibe(id) })),
  });
});

app.get('/api/days', ready, async (req, res) => {
  const host = await hostFrom(req);
  if (!host) return res.status(404).json({ error: 'Sahifa topilmadi' });
  res.json((await L.days(host.id)).map(({ date, day, month, weekday, free }) => ({ date, day, month, weekday, free })));
});

app.get('/api/slots', ready, async (req, res) => {
  const host = await hostFrom(req);
  if (!host) return res.status(404).json({ error: 'Sahifa topilmadi' });
  res.json(await L.slotsFor(host.id, String(req.query.date || '')));
});

// Oddiy spam himoyasi: bitta IP dan soatiga 15 ta urinish
const hits = new Map();
function rateLimited(ip) {
  const t = Date.now();
  const arr = (hits.get(ip) || []).filter((x) => t - x < 3600e3);
  arr.push(t);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 15;
}

// Sayt faqat qoralama yaratadi. Odam Telegram botga o'tadi va o'sha yerda tasdiqlaydi —
// shunda uning Telegram ismi va username'i avtomatik olinadi (ism/telefon so'ralmaydi).
app.post('/api/draft', ready, async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // bot tuzog'i
  if (String(b.note || '').length > 500) return res.status(400).json({ error: 'Izoh juda uzun' });
  const host = await hostFrom(req);
  if (!host) return res.status(404).json({ error: 'Sahifa topilmadi' });
  if (!(await bot.ensureUsername())) return res.status(503).json({ error: 'Hozir yuborib bo\'lmadi. Birozdan keyin urinib ko\'ring.' });
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.' });
  let d;
  try {
    d = await L.createDraft({ hostId: host.id, place: b.place, placeText: b.placeText, note: b.note, date: b.date, time: b.time });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  res.json({
    ok: true,
    when: `${L.prettyDate(d.date)}, ${d.time}`,
    place: `${L.PLACES[d.place].emoji} ${L.placeName(d)}`,
    botLink: `https://t.me/${bot.username()}?start=d_${d.token}`,
  });
});

// Sahifalar: bosh sahifa (tanishtiruv) va har bir foydalanuvchining sahifasi — bitta index.html,
// qaysi biri ekanini app.js manzildan aniqlaydi
const indexFile = path.join(__dirname, 'public', 'index.html');
const sendIndex = (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(indexFile); };
app.get('/', sendIndex);
app.get('/:slug', (req, res, next) => (/^[A-Za-z0-9_]{3,32}$/.test(req.params.slug) ? sendIndex(req, res) : next()));

app.listen(CFG.port, '0.0.0.0', () => {
  console.log(`🌐 Sayt: http://localhost:${CFG.port}`);
  if (!CFG.token) console.warn('⚠️  BOT_TOKEN yo\'q — sayt ishlaydi, lekin Telegram xabarlari yuborilmaydi.');
  else if (!CFG.ownerChatId) console.warn('⚠️  OWNER_CHAT_ID yo\'q — botga /start yozing, u ID ni aytadi.');
});
// Bot ishga tushishi listen signaliga bog'liq emas (ba'zi hostinglar uni chaqirmaydi)
L.DB.init()
  .then(() => bot.start())
  .catch((e) => console.error('❌ Ishga tushirishda xato:', e.message));
