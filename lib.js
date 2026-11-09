'use strict';
// Umumiy qism: vaqt, joylar, matnlar, foydalanuvchilar (har biri o'z havolasi bilan), takliflar
const crypto = require('crypto');
const { CFG } = require('./config');
const DB = require('./db');
const { q, tx } = DB;

// ---------- Uchrashuv joylari ----------
const PLACES = {
  cinema:     { emoji: '🎬', name: 'Kinoteatr',      vibe: 'Film tanlash sizdan, popkorn mendan 🍿',
                closing: 'Film qanday bo\'lishidan qat\'i nazar, vaqt ajoyib o\'tadi — chunki birga bo\'lamiz 🎬' },
  park:       { emoji: '🌳', name: 'Park',           vibe: 'Toza havo, sayr va uzoq suhbat 🍃',
                closing: 'Yo\'laklar, yengil shabada va uzoq suhbat — shu kunni sabrsizlik bilan kutaman 🌿' },
  cafe:       { emoji: '☕', name: 'Kafe',           vibe: 'Bir piyola qahva ustida gurung ☕',
                closing: 'Qahva iliq, suhbat undan ham iliq bo\'ladi — stolimiz sizni kutyapti ☕' },
  restaurant: { emoji: '🍽', name: 'Restoran',       vibe: 'Mazali kechki ovqat va yaxshi kayfiyat 🍝',
                closing: 'Eng yaxshi stol — biz uchun. Mazali va unutilmas uchrashuv bo\'ladi 🍽✨' },
  travel:     { emoji: '✈️', name: 'Sayohat',        vibe: 'Yangi joylarni birga kashf qilamiz 🗺',
                closing: 'Yo\'l qancha uzoq bo\'lsa, xotiralar shuncha ko\'p bo\'ladi — sumkani tayyorlayvering ✈️' },
  nature:     { emoji: '🏞', name: 'Tabiat qo\'yni',  vibe: 'Tog\', daryo bo\'yi yoki piknik 🧺',
                closing: 'Toza havo, keng osmon va biz — tabiat qo\'yni bizni chaqiryapti 🏞' },
  walk:       { emoji: '🌆', name: 'Shahar sayri',   vibe: 'Kechki shahar bo\'ylab piyoda sayr 🌙',
                closing: 'Shahar ko\'chalari bo\'ylab shoshilmay sayr — bu kun boshqacha bo\'ladi 🌆' },
  games:      { emoji: '🎳', name: 'O\'yin markazi',  vibe: 'Bouling, bilyard yoki karting 🎯',
                closing: 'Kim yutsa ham, eng ko\'p kulgan g\'olib — tayyor turing 😄🎳' },
  concert:    { emoji: '🎤', name: 'Konsert / teatr', vibe: 'Jonli musiqa va unutilmas kecha 🎶',
                closing: 'Musiqa baland, kayfiyat undan ham baland — unutilmas lahzalar bo\'ladi 🎶' },
  other:      { emoji: '✨', name: 'Boshqa joy',     vibe: 'Qayerda bo\'lsa ham, asosiysi birga 🤍',
                closing: 'Qayerda bo\'lishimiz muhim emas — asosiysi, birga bo\'lamiz 🤍' },
};

// ---------- Vaqt yordamchilari ----------
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const WD_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function now() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CFG.tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dParts = (date) => { const d = new Date(date + 'T00:00:00Z'); return { day: d.getUTCDate(), mon: d.getUTCMonth(), wd: d.getUTCDay() }; };
const weekday = (date) => dParts(date).wd;
function prettyDate(date) {
  const p = dParts(date);
  return `${p.day}-${MONTHS[p.mon]}, ${WEEKDAYS[p.wd]}`;
}
function shortDate(date) {
  const p = dParts(date);
  return `${WD_SHORT[p.wd]}, ${p.day}-${MONTHS[p.mon].slice(0, 3)}`;
}
const isActive = (r) => r.status === 'pending' || r.status === 'approved';
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d));

// Ish vaqti hammaga bir xil (.env). Band vaqtlar esa har bir odamniki alohida.
function baseSlots(date) {
  const n = now();
  const last = addDays(n.date, CFG.daysAhead - 1);
  if (!isDate(date) || date < n.date || date > last) return [];
  if (!CFG.workDays.includes(weekday(date))) return [];
  const bS = CFG.breakStart ? toMin(CFG.breakStart) : -1;
  const bE = CFG.breakEnd ? toMin(CFG.breakEnd) : -1;
  const out = [];
  for (let t = toMin(CFG.workStart); t + CFG.slot <= toMin(CFG.workEnd); t += CFG.slot) {
    if (bS >= 0 && t < bE && t + CFG.slot > bS) continue;
    if (date === n.date && t < n.min + CFG.minNotice) continue;
    out.push(toTime(t));
  }
  return out;
}
// run: q yoki tranzaksiya ichidagi t
async function slotsFor(hostId, date, run = q) {
  const base = baseSlots(date);
  if (!base.length) return [];
  const [blk] = await run('SELECT COUNT(*) AS n FROM blocked_days WHERE host_id = ? AND date = ?', [hostId, date]);
  if (blk.n) return [];
  const rows = await run('SELECT time FROM requests WHERE host_id = ? AND date = ? AND status IN ("pending","approved")', [hostId, date]);
  const taken = new Set(rows.map((r) => r.time));
  return base.map((time) => ({ time, available: !taken.has(time) }));
}
async function days(hostId) {
  const n = now();
  const last = addDays(n.date, CFG.daysAhead - 1);
  const blocked = new Set((await q('SELECT date FROM blocked_days WHERE host_id = ? AND date BETWEEN ? AND ?', [hostId, n.date, last])).map((r) => r.date));
  const busy = {};
  for (const r of await q('SELECT date, time FROM requests WHERE host_id = ? AND date BETWEEN ? AND ? AND status IN ("pending","approved")', [hostId, n.date, last])) {
    (busy[r.date] ||= new Set()).add(r.time);
  }
  const out = [];
  for (let i = 0; i < CFG.daysAhead; i++) {
    const date = addDays(n.date, i);
    const p = dParts(date);
    const base = blocked.has(date) ? [] : baseSlots(date);
    out.push({
      date, i,
      day: p.day,
      month: MONTHS[p.mon].slice(0, 3),
      weekday: WD_SHORT[p.wd],
      free: base.filter((t) => !busy[date]?.has(t)).length,
      blocked: blocked.has(date),
      workday: CFG.workDays.includes(p.wd),
    });
  }
  return out;
}

// ---------- Matnlar (admin o'zgartiradi, hamma uchun umumiy) ----------
// Har so'rov boshida bazadan yangilanadi (loadSettings)
const S = { texts: {}, stickers: {} };
async function loadSettings() {
  const rows = await q('SELECT k, v FROM settings WHERE k IN ("texts", "stickers")');
  S.texts = {}; S.stickers = {};
  for (const r of rows) { try { S[r.k] = JSON.parse(r.v) || {}; } catch {} }
  return S;
}
async function saveSetting(k) {
  await q('REPLACE INTO settings (k, v) VALUES (?, ?)', [k, JSON.stringify(S[k] || {})]);
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'do\'stim';
// {ism} — taklif qilinayotgan odamning ismi bilan almashtiriladi
const fill = (s, vars = {}) => String(s).replace(/\{ism\}/g, vars.ism ?? '');

const vibe = (place) => S.texts?.[place]?.vibe ?? PLACES[place]?.vibe ?? '';
const closing = (place) => S.texts?.[place]?.closing ?? PLACES[place]?.closing ?? PLACES.other.closing;
const DEFAULT_SIGNOFF = 'Ko\'rishguncha! 🌸\n— {ism}';
const signoff = (vars) => fill(S.texts?._signoff ?? DEFAULT_SIGNOFF, vars);
const TEXTS = {
  site_title: { group: 'site', label: '🌐 Sayt sarlavhasi', hint: 'Saytning eng tepasidagi katta yozuv', def: () => 'See you soon' },
  site_sub:   { group: 'site', label: '🌐 Sayt izohi', hint: 'Sarlavha ostidagi kichik yozuv. {ism} — kimga taklif qilinayotgani', def: () => '{ism} bilan qachon va qayerda ko\'rishamiz? 🌸' },
  welcome:    { group: 'bot', label: '👋 Salomlashish', hint: 'Mehmon havolani ochganda chiqadi. "Salom, Ism!" qatori avtomatik qo\'shiladi. {ism} — kimga taklif qilinayotgani', def: () => 'Men {ism} bilan uchrashuv belgilashga yordam beraman 🤖\n\n🎬 kino  ·  🌳 park  ·  ☕ kafe  ·  ✈️ sayohat\n\nJoyni tanlang, vaqtni belgilang — qolganini men hal qilaman 💫' },
  note_ask:   { group: 'bot', label: '💭 Izoh so\'rash', hint: '4-qadamda (izoh yozish) chiqadigan misol', def: () => 'Masalan: qaysi filmga boramiz, qayerda kutishim kerak... 🙂' },
  waiting:    { group: 'bot', label: '⏳ Kutish yozuvi', hint: 'Taklif yuborilgandan keyin mehmonga chiqadi', def: () => '⏳ Uning javobini kutyapmiz...' },
  declined:   { group: 'bot', label: '🥺 Rad etish xabari', hint: 'Taklif rad etilganda mehmonga boradi (sana va vaqt avtomatik qo\'shiladi)', def: () => 'Afsuski, bu vaqtda bo\'sh emas ekan.\n\nBoshqa vaqtni tanlab ko\'rasizmi? 🌸' },
};
const txt = (key, vars) => fill(S.texts?.common?.[key] ?? TEXTS[key].def(), vars);
const pname = (k) => S.texts?.[k]?.name ?? PLACES[k]?.name ?? k;
const placeName = (r) => (r.place === 'other' && r.placeText ? r.placeText : (PLACES[r.place] ? pname(r.place) : 'Uchrashuv'));
const placeLine = (r) => `${PLACES[r.place]?.emoji || '✨'} <b>${esc(placeName(r))}</b>`;

// ---------- Foydalanuvchilar va shaxsiy havolalar ----------
const RESERVED = new Set(['api', 'tg', 'cron', 'health', 'vendor', 'admin', 'bot', 'static', 'public', 'index', 'app', 'www',
  'favicon', 'robots', 'sitemap', 'login', 'help', 'about', 'seeyousoon']);
const SLUG_RE = /^[a-z0-9_]{3,32}$/;
const slugOk = (s) => SLUG_RE.test(s) && !RESERVED.has(s) && !/^\d+$/.test(s);
const userRow = (u) => u && ({ id: Number(u.id), name: u.name, username: u.username, phone: u.phone, phoneAsked: !!u.phone_asked, lastMsgId: u.last_msg_id, slug: u.slug, since: u.since });

async function getUser(id) {
  const [u] = await q('SELECT * FROM users WHERE id = ?', [id]);
  return userRow(u) || null;
}
async function getHostBySlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (!SLUG_RE.test(s)) return null;
  const [u] = await q('SELECT * FROM users WHERE slug = ?', [s]);
  return userRow(u) || null;
}
// Har bir xabarda: foydalanuvchini yaratadi / yangilaydi. { user, isNew }
async function touchUser(from, lastMsgId) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 128);
  const res = await q(`INSERT INTO users (id, name, username, last_msg_id) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE name = VALUES(name), username = VALUES(username), last_msg_id = COALESCE(VALUES(last_msg_id), last_msg_id)`,
  [from.id, name, from.username || '', lastMsgId ?? null]);
  return { user: await getUser(from.id), isNew: res.affectedRows === 1 };
}
// Havola nomini avtomatik tanlash: username → ism (lotin) → u + ID
const translit = (s) => String(s || '').toLowerCase()
  .replace(/[‘’ʻʼ`']/g, '')
  .replace(/[а-яё]/g, (c) => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya' }[c] ?? ''))
  .replace(/[^a-z0-9_]/g, '');
async function slugFree(s, userId) {
  const [r] = await q('SELECT id FROM users WHERE slug = ?', [s]);
  return !r || Number(r.id) === Number(userId);
}
async function ensureSlug(user) {
  if (user.slug) return user.slug;
  const cands = [];
  if (user.username) cands.push(user.username.toLowerCase());
  const t = translit(firstName(user.name)).slice(0, 24);
  if (t.length >= 3) cands.push(t);
  for (const c of cands) {
    if (!slugOk(c)) continue;
    if (await slugFree(c, user.id)) return setSlugRaw(user.id, c);
    for (let i = 2; i < 100; i++) { const c2 = `${c}${i}`.slice(0, 32); if (await slugFree(c2, user.id)) return setSlugRaw(user.id, c2); }
  }
  return setSlugRaw(user.id, `u${String(user.id).slice(-8)}${crypto.randomBytes(1).toString('hex')}`);
}
async function setSlugRaw(id, slug) {
  await q('UPDATE users SET slug = ? WHERE id = ?', [slug, id]);
  return slug;
}
// Foydalanuvchi o'zi tanlagan nom. Xato bo'lsa — sababini qaytaradi
async function changeSlug(id, wanted) {
  const s = String(wanted || '').trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '');
  if (!SLUG_RE.test(s)) return { error: 'Faqat lotin harflari, raqam va _ belgisi, 3–32 ta belgi bo\'lsin. Masalan: madina_23' };
  if (!slugOk(s)) return { error: 'Bu nomni ishlatib bo\'lmaydi, boshqasini tanlang.' };
  if (!(await slugFree(s, id))) return { error: 'Bu nom band 😔 Boshqasini tanlang.' };
  try { await setSlugRaw(id, s); } catch { return { error: 'Bu nom band 😔 Boshqasini tanlang.' }; }
  return { slug: s };
}
const pageUrl = (slug) => `${CFG.siteUrl}/${slug}`;
async function setPhone(id, phone) {
  await q('UPDATE users SET phone = ? WHERE id = ?', [phone, id]);
  await q('UPDATE requests SET phone = ? WHERE guest_id = ? AND status IN ("pending","approved")', [phone, id]);
}
const markPhoneAsked = (id) => q('UPDATE users SET phone_asked = 1 WHERE id = ?', [id]);

// ---------- Takliflar ----------
class ReqError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const reqRow = (r) => r && ({
  id: r.id, token: r.token, hostId: Number(r.host_id),
  guestChatId: r.guest_id ? Number(r.guest_id) : null,
  guest: r.guest_id ? { id: Number(r.guest_id), name: r.guest_name || r.name, username: r.guest_username, phone: r.phone } : null,
  name: r.name, phone: r.phone, place: r.place, placeText: r.place_text, note: r.note || '',
  date: r.date, time: r.time, source: r.source, status: r.status,
  ownerMsgId: r.owner_msg_id, reminded: !!r.reminded, cancelledBy: r.cancelled_by, createdAt: r.created_at,
});
async function getRequest(id) {
  const [r] = await q('SELECT * FROM requests WHERE id = ?', [id]);
  return reqRow(r) || null;
}
async function listRequests(where, params = [], limit = 20) {
  return (await q(`SELECT * FROM requests WHERE ${where} ORDER BY date, time LIMIT ${Number(limit)}`, params)).map(reqRow);
}
async function setStatus(id, status, extra = {}) {
  await q('UPDATE requests SET status = ?, cancelled_by = COALESCE(?, cancelled_by), updated_at = NOW() WHERE id = ?', [status, extra.cancelledBy || null, id]);
}
const setOwnerMsg = (id, msgId) => q('UPDATE requests SET owner_msg_id = ? WHERE id = ?', [msgId, id]);
const isBlocked = async (hostId, guestId) => (await q('SELECT 1 FROM guest_blocks WHERE host_id = ? AND guest_id = ?', [hostId, guestId])).length > 0;

function cleanPlace(d) {
  const place = PLACES[d.place] ? d.place : null;
  if (!place) throw new ReqError('Uchrashuv joyini tanlang');
  const placeText = String(d.placeText || '').trim().slice(0, 60);
  if (place === 'other' && placeText.length < 2) throw new ReqError('Joy nomini yozing');
  return { place, placeText: place === 'other' ? placeText : '' };
}

// Taklif yaratish — tranzaksiya ichida: bir vaqtni ikki kishi bir paytda ololmaydi
async function createRequest(d) {
  const { place, placeText } = cleanPlace(d);
  const note = String(d.note || '').trim().slice(0, 500);
  const guestId = d.guest?.id || null;
  if (guestId && Number(guestId) === Number(d.hostId)) throw new ReqError('O\'zingizni taklif qila olmaysiz 🙂', 400);
  return tx(async (t) => {
    const [host] = await t('SELECT id FROM users WHERE id = ? FOR UPDATE', [d.hostId]);
    if (!host) throw new ReqError('Bu odam topilmadi', 404);
    if (guestId) {
      if ((await t('SELECT 1 FROM guest_blocks WHERE host_id = ? AND guest_id = ?', [d.hostId, guestId])).length) {
        throw new ReqError('Bu odamga taklif yuborib bo\'lmaydi.', 403);
      }
      const [{ a }] = await t('SELECT COUNT(*) AS a FROM requests WHERE host_id = ? AND guest_id = ? AND status IN ("pending","approved")', [d.hostId, guestId]);
      if (a >= CFG.maxActivePerGuest) throw new ReqError(`Bu odamga allaqachon ${CFG.maxActivePerGuest} ta faol taklifingiz bor 🙂`, 429);
      const [{ c }] = await t('SELECT COUNT(*) AS c FROM requests WHERE guest_id = ? AND created_at > NOW() - INTERVAL 1 DAY', [guestId]);
      if (c >= CFG.maxNewPerGuestDay) throw new ReqError('Bugun juda ko\'p taklif yubordingiz. Ertaga urinib ko\'ring 🙂', 429);
    }
    const slot = (await slotsFor(d.hostId, String(d.date), t)).find((s) => s.time === d.time);
    if (!slot || !slot.available) throw new ReqError('Bu vaqt band bo\'lib qoldi. Boshqa vaqtni tanlang.', 409);
    const r = {
      id: crypto.randomBytes(4).toString('hex'),
      token: crypto.randomBytes(8).toString('hex'),
    };
    const name = String(d.name || '').trim().slice(0, 80) || 'Mehmon';
    await t(`INSERT INTO requests (id, token, host_id, guest_id, guest_name, guest_username, name, phone, place, place_text, note, date, time, source, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`,
    [r.id, r.token, d.hostId, guestId, d.guest?.name || name, d.guest?.username || '', name, String(d.phone || '').slice(0, 30),
      place, placeText, note, d.date, d.time, d.source || 'bot']);
    return reqRow((await t('SELECT * FROM requests WHERE id = ?', [r.id]))[0]);
  });
}

// Saytdan kelgan qoralama: joy + vaqt. Bot ochilganda taklifga aylanadi (2 soat amal qiladi)
async function createDraft(d) {
  const { place, placeText } = cleanPlace(d);
  const slot = (await slotsFor(d.hostId, String(d.date))).find((s) => s.time === d.time);
  if (!slot || !slot.available) throw new ReqError('Bu vaqt band bo\'lib qoldi. Boshqa vaqtni tanlang.', 409);
  await q('DELETE FROM drafts WHERE exp < ?', [Date.now()]);
  const token = crypto.randomBytes(8).toString('hex');
  const data = { place, placeText, note: String(d.note || '').trim().slice(0, 500), date: d.date, time: d.time };
  await q('INSERT INTO drafts (token, host_id, data, exp) VALUES (?, ?, ?, ?)', [token, d.hostId, JSON.stringify(data), Date.now() + 2 * 3600e3]);
  return { token, hostId: d.hostId, ...data };
}
async function takeDraft(token) {
  const [d] = await q('SELECT * FROM drafts WHERE token = ?', [String(token).slice(0, 16)]);
  if (!d) return null;
  await q('DELETE FROM drafts WHERE token = ?', [d.token]);
  if (Number(d.exp) < Date.now()) return null;
  return { hostId: Number(d.host_id), ...JSON.parse(d.data) };
}

// ---------- Suhbat holati (har chat uchun) ----------
async function loadSession(chatId) {
  const [r] = await q('SELECT data FROM sessions WHERE chat_id = ?', [chatId]);
  try { return r ? JSON.parse(r.data) : { step: null, draft: {} }; } catch { return { step: null, draft: {} }; }
}
async function saveSession(chatId, data) {
  if (!data) return q('DELETE FROM sessions WHERE chat_id = ?', [chatId]);
  return q('REPLACE INTO sessions (chat_id, data) VALUES (?, ?)', [chatId, JSON.stringify(data)]);
}

// ---------- Kunlarni yopish, bloklash, yozishma ----------
async function toggleDay(hostId, date) {
  const r = await q('DELETE FROM blocked_days WHERE host_id = ? AND date = ?', [hostId, date]);
  if (r.affectedRows) return false;
  await q('INSERT IGNORE INTO blocked_days (host_id, date) VALUES (?, ?)', [hostId, date]);
  return true;
}
const blockGuest = (hostId, guestId) => q('INSERT IGNORE INTO guest_blocks (host_id, guest_id) VALUES (?, ?)', [hostId, guestId]);
const unblockGuest = (hostId, guestId) => q('DELETE FROM guest_blocks WHERE host_id = ? AND guest_id = ?', [hostId, guestId]);
const listBlocked = (hostId) => q(`SELECT b.guest_id AS id, u.name, u.username FROM guest_blocks b LEFT JOIN users u ON u.id = b.guest_id
  WHERE b.host_id = ? ORDER BY b.created_at DESC LIMIT 30`, [hostId]);
const addRelay = (hostId, msgId, guestId) => q('REPLACE INTO relay (host_id, msg_id, guest_id) VALUES (?, ?, ?)', [hostId, msgId, guestId]);
async function getRelay(hostId, msgId) {
  const [r] = await q('SELECT guest_id FROM relay WHERE host_id = ? AND msg_id = ?', [hostId, msgId]);
  return r ? Number(r.guest_id) : null;
}

module.exports = {
  CFG, DB, q, PLACES, WEEKDAYS, MONTHS,
  toMin, now, addDays, prettyDate, shortDate, isActive, isDate, slotsFor, days,
  S, loadSettings, saveSetting, TEXTS, txt, fill, firstName,
  esc, pname, placeName, placeLine, vibe, closing, signoff, DEFAULT_SIGNOFF,
  getUser, getHostBySlug, touchUser, ensureSlug, changeSlug, pageUrl, setPhone, markPhoneAsked, slugOk,
  ReqError, getRequest, listRequests, setStatus, setOwnerMsg, isBlocked, createRequest, createDraft, takeDraft,
  loadSession, saveSession, toggleDay, blockGuest, unblockGuest, listBlocked, addRelay, getRelay,
};
