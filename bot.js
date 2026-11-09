'use strict';
// Telegram bot — ko'p foydalanuvchili:
//  • har kim /start bosib o'z havolasini oladi (seeyousoon.uz/<nom>)
//  • havolani ochgan do'stlari joy va vaqt tanlab, unga taklif yuboradi
//  • taklif havola egasiga keladi: ✅ qabul / ❌ rad / 🚫 bloklash
//  • admin (OWNER_CHAT_ID): matnlar, joy nomlari, stikerlar, umumiy statistika
const crypto = require('crypto');
const L = require('./lib');
const { CFG, esc, PLACES } = L;

let botUsername = '';
// Diagnostika: /health sahifasida ko'rinadi
const stats = { updates: 0, lastUpdateAt: null, lastError: null, lastTgError: null, startedAt: new Date().toISOString() };

// ================= Telegram API =================
async function tg(method, body = {}) {
  if (!CFG.token) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${CFG.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!j.ok && method !== 'getUpdates' && !/not modified/.test(j.description || '')) {
      console.error(`[tg] ${method}:`, j.description);
      stats.lastTgError = `${new Date().toISOString()} ${method}: ${j.description}`;
    }
    return j;
  } catch (e) {
    if (method !== 'getUpdates') {
      console.error(`[tg] ${method}:`, e.message);
      stats.lastTgError = `${new Date().toISOString()} ${method}: ${e.message}`;
    }
    return { ok: false, description: e.message };
  }
}
const send = (chat_id, text, extra = {}) =>
  tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
async function edit(chat_id, message_id, text, reply_markup) {
  const r = await tg('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup });
  if (!r.ok && !/not modified/.test(r.description || '')) return send(chat_id, text, { reply_markup });
  return r;
}
const ik = (rows) => ({ inline_keyboard: rows });
const btn = (text, data) => ({ text, callback_data: data });
const chunk = (arr, n) => arr.reduce((a, x, i) => (i % n ? a[a.length - 1].push(x) : a.push([x]), a), []);
const isAdmin = (id) => !!CFG.ownerChatId && String(id) === String(CFG.ownerChatId);
const publicSite = () => /^https?:\/\//.test(CFG.siteUrl) && !/localhost|127\.0\.0\.1/.test(CFG.siteUrl);
const botLink = (slug) => `https://t.me/${botUsername}?start=h_${slug}`;
// Ulashiladigan havola: sayt ochiq bo'lsa — sayt sahifasi, aks holda bot havolasi
const shareLink = (slug) => (publicSite() ? L.pageUrl(slug) : botLink(slug));
const fullName = (from) => [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Mehmon';

// ================= Stikerlar (admin o'rnatadi) =================
const STICKERS = {
  welcome:   { label: '👋 Salomlashish',            emoji: '👋' },
  sent:      { label: '💌 Taklif yuborilganda',      emoji: '💌' },
  newreq:    { label: '🔔 Taklif kelganda',          emoji: '😍' },
  approved:  { label: '🎉 Tasdiqlanganda',           emoji: '🎉' },
  declined:  { label: '🥺 Rad etilganda',            emoji: '🥺' },
  cancelled: { label: '💔 Bekor qilinganda',         emoji: '💔' },
  reminder:  { label: '⏰ Eslatma',                  emoji: '⏰' },
};
async function sticker(chatId, ev) {
  const id = L.S.stickers?.[ev];
  if (id) {
    const r = await tg('sendSticker', { chat_id: chatId, sticker: id });
    if (r.ok) return;
  }
  await tg('sendMessage', { chat_id: chatId, text: STICKERS[ev].emoji }); // bitta emoji = animatsion stiker
}

// ================= Matn bo'laklari =================
const bar = (n) => '▰'.repeat(n) + '▱'.repeat(4 - n);
const LINE = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';
const timeIcon = (t) => (L.toMin(t) < 12 * 60 ? '🌅' : L.toMin(t) < 17 * 60 ? '☀️' : '🌙');
const STATUS = { pending: '⏳ Javob kutilmoqda', approved: '✅ Qabul qilindi', declined: '❌ Rad etildi', cancelled: '💔 Bekor qilindi' };

// Profilga havola: username → t.me/username (doim ishlaydi), raqam → t.me/+raqam, aks holda tg://user?id
function profileUrl(u = {}) {
  if (u.username) return `https://t.me/${u.username}`;
  if (u.phone) return `https://t.me/${u.phone.replace(/[^\d+]/g, '')}`;
  return `tg://user?id=${u.id}`;
}
function whoIs(u = {}) {
  const name = esc(u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Nomsiz');
  const link = `<a href="${profileUrl(u)}">${name}</a>`;
  if (u.username) return `${link} (@${esc(u.username)})`;
  return `${link}${u.phone ? ` · 📱 ${esc(u.phone)}` : ''} · 🆔 <code>${u.id}</code>`;
}
const guestLabel = (r) => (r.guest ? whoIs(r.guest) : `<b>${esc(r.name)}</b>`);

// Kimga taklif qilinayotgani (ism) — mehmon xabarlarida ishlatiladi
async function hostName(hostId) {
  const h = await L.getUser(hostId);
  return L.firstName(h?.name);
}

function ticket(r, title, ism) {
  return [
    title,
    LINE,
    ism ? `🤝 <b>${esc(ism)}</b> bilan` : null,
    L.placeLine(r),
    `📅 ${L.prettyDate(r.date)}`,
    `${timeIcon(r.time)} soat <b>${r.time}</b>`,
    r.note ? `💭 <i>${esc(r.note)}</i>` : null,
    LINE,
    L.vibe(r.place) ? `<i>${esc(L.vibe(r.place))}</i>` : null,
  ].filter(Boolean).join('\n');
}
function approvedText(r, ism) {
  const sign = esc(L.signoff({ ism })).split('\n').map((l, i, a) => (i === a.length - 1 && /^\s*[—-]/.test(l) ? `<i>${l}</i>` : l)).join('\n');
  return ticket(r, '🎉 <b>Ura! Uchrashuv tasdiqlandi!</b>', ism) + `\n\n${esc(L.closing(r.place))}\n\n${sign}`;
}
function declinedText(r, ism) {
  return `🥺 <b>${L.placeLine(r).replace(/<\/?b>/g, '')}</b> · ${esc(ism)} bilan\n📅 ${L.prettyDate(r.date)}, soat ${r.time}\n\n${esc(L.txt('declined', { ism }))}`;
}

// ================= Suhbat holati =================
// Har bir xabar/tugma bosilishida bazadan o'qiladi va oxirida saqlanadi (handleUpdate)
const SESS = new Map();
function getState(chatId) {
  if (!SESS.has(chatId)) SESS.set(chatId, { step: null, draft: {} });
  const s = SESS.get(chatId);
  s.draft ||= {};
  return s;
}

// ================= Menyular =================
const HOST_KB = (admin) => ({
  keyboard: [
    [{ text: '📅 Bugun' }, { text: '🗓 Kelgusi' }],
    [{ text: '🔗 Havolam' }, { text: '🔒 Kunlar' }],
    [{ text: '📋 Takliflarim' }],
    ...(admin ? [[{ text: '🎨 Stikerlar' }, { text: '✍️ Matnlar' }, { text: '📊 Statistika' }]] : []),
  ],
  resize_keyboard: true,
  is_persistent: true,
});

// ---- Havola egasi (host) ----
async function hostHome(user, intro = true) {
  const slug = await L.ensureSlug(user);
  const link = shareLink(slug);
  const shareText = 'Men bilan uchrashuv belgilang 🌸';
  const rows = [
    [{ text: '📤 Do\'stlarga yuborish', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}` }],
    [btn('✏️ Havola nomini o\'zgartirish', 'sl')],
    [btn('📋 Men yuborgan takliflar', 'my')],
  ];
  const [{ n }] = await L.q('SELECT COUNT(*) AS n FROM guest_blocks WHERE host_id = ?', [user.id]);
  if (n) rows.push([btn(`🚫 Bloklanganlar (${n})`, 'bls')]);
  return {
    text:
      (intro ? `🌸 <b>Salom, ${esc(L.firstName(user.name))}!</b>\n\nBu bot orqali do'stlaringiz sizni uchrashuvga taklif qila oladi 💌\n\n` : '') +
      `🔗 <b>Sizning havolangiz:</b>\n${esc(link)}\n` +
      (publicSite() ? `\n<i>Telegram uchun:</i> ${esc(botLink(slug))}\n` : '') +
      `\nUni do'stlaringizga yuboring — ular joy va vaqt tanlab, sizga taklif yuborishadi. Taklif shu yerga keladi, siz ✅ yoki ❌ bosasiz.`,
    kb: ik(rows),
  };
}

// ---- Mehmon (taklif qiluvchi) ekranlari ----
const S = {
  guestHome(first, ism) {
    return {
      text: `🌸 <b>Salom, ${esc(first)}!</b>\n\n${esc(L.txt('welcome', { ism }))}`,
      kb: ik([
        [btn(`💌 ${ism}ni uchrashuvga taklif qilish`, 'go|place')],
        [btn('📋 Mening takliflarim', 'my')],
        [btn('✨ O\'z havolamni olish', 'me')],
      ]),
    };
  },
  place(d) {
    const rows = chunk(Object.entries(PLACES).map(([k, p]) => btn(`${p.emoji} ${L.pname(k)}`, `pl|${k}`)), 2);
    rows.push([btn('⬅️ Orqaga', 'ghome')]);
    return { text: `📍 <b>Qayerda ko'rishamiz?</b>\n${bar(1)}  <i>1-qadam / 4</i>\n\n🤝 <b>${esc(d.hostName)}</b> bilan\nO'zingizga yoqqan joyni tanlang 👇`, kb: ik(rows) };
  },
  placeAsk() {
    return {
      text: `✍️ <b>Joy nomini yozing</b>\n\nMasalan: <i>Magic City, Chorvoq, Ko'kcha bog'i</i> 🏡\n\nShunchaki xabar qilib yuboring 👇`,
      kb: ik([[btn('⬅️ Orqaga', 'go|place')]]),
    };
  },
  async day(d) {
    const list = (await L.days(d.host)).filter((x) => x.free > 0);
    const label = (x) => (x.i === 0 ? '🔹 Bugun' : x.i === 1 ? '🔹 Ertaga' : L.shortDate(x.date));
    const rows = chunk(list.map((x) => btn(label(x), `dy|${x.date}`)), 3);
    rows.push([btn('⬅️ Orqaga', 'go|place')]);
    const empty = list.length ? '' : '\n\n😔 Yaqin kunlarda bo\'sh vaqt qolmadi.';
    return { text: `📅 <b>Qaysi kuni?</b>\n${bar(2)}  <i>2-qadam / 4</i>\n\n${L.placeLine(d)}${empty}`, kb: ik(rows) };
  },
  async time(d) {
    const slots = (await L.slotsFor(d.host, d.date)).filter((s) => s.available);
    const rows = chunk(slots.map((s) => btn(`${timeIcon(s.time)} ${s.time}`, `tm|${s.time}`)), 3);
    rows.push([btn('⬅️ Orqaga', 'go|day')]);
    return {
      text: `🕐 <b>Soat nechada?</b>\n${bar(3)}  <i>3-qadam / 4</i>\n\n${L.placeLine(d)}\n📅 ${L.prettyDate(d.date)}\n\n🌅 ertalab  ·  ☀️ kunduzi  ·  🌙 kechqurun`,
      kb: ik(rows),
    };
  },
  note() {
    return {
      text:
        `💭 <b>Biror so'z qoldirasizmi?</b>\n${bar(4)}  <i>4-qadam / 4</i>\n\n` +
        `${esc(L.txt('note_ask'))}\n\n✍️ Yozib yuboring yoki o'tkazib yuboring.`,
      kb: ik([[btn('⏭ O\'tkazib yuborish', 'note|skip')], [btn('⬅️ Orqaga', 'go|time')]]),
    };
  },
  confirm(d) {
    return {
      text: ticket(d, '💌 <b>Taklifnoma tayyor!</b>', d.hostName) + '\n\nHammasi to\'g\'rimi?',
      kb: ik([
        [btn('✅ Taklifni yuborish', 'send')],
        [btn('📍 Joyni o\'zgartirish', 'go|place'), btn('📅 Vaqtni o\'zgartirish', 'go|day')],
        [btn('✖️ Bekor qilish', 'ghome')],
      ]),
    };
  },
  // Men yuborgan (mehmon sifatida) faol takliflar
  async my(chatId) {
    const n = L.now();
    const rows = await L.q(`SELECT r.*, u.name AS host_name FROM requests r LEFT JOIN users u ON u.id = r.host_id
      WHERE r.guest_id = ? AND r.status IN ("pending","approved") AND r.date >= ? ORDER BY r.date, r.time LIMIT 15`, [chatId, n.date]);
    if (!rows.length) {
      return {
        text: `📋 <b>Men yuborgan takliflar</b>\n\nHozircha faol taklif yo'q 🌙\nKimnidir taklif qilish uchun uning havolasini oching.`,
        kb: ik([[btn('🏠 Bosh menyu', 'home')]]),
      };
    }
    const list = rows.map((x) => ({ ...x, placeText: x.place_text }));
    const text = `📋 <b>Men yuborgan takliflar</b>\n\n` + list.map((r) =>
      `🤝 <b>${esc(L.firstName(r.host_name))}</b> · ${L.placeLine(r)}\n📅 ${L.shortDate(r.date)} · ${timeIcon(r.time)} ${r.time}\n${STATUS[r.status]}`).join(`\n${LINE}\n`);
    const kb = list.map((r) => [btn(`✖️ ${L.firstName(r.host_name)} · ${L.shortDate(r.date)} ${r.time}`, `gc|${r.id}`)]);
    kb.push([btn('🏠 Bosh menyu', 'home')]);
    return { text, kb: ik(kb) };
  },
};

// Mehmon oqimini boshlash: kimga taklif qilinayotgani sessiyada saqlanadi
async function startGuestFlow(st, host) {
  st.step = null;
  st.draft = { host: host.id, hostName: L.firstName(host.name) };
}

// ================= Havola egasiga xabarlar =================
// Telegram ID orqali profilga o'tish tugmasi. Odam profilini yopgan bo'lsa Telegram tugmani rad etadi —
// unda xabar tugmasiz yuboriladi va reply orqali yozish taklif qilinadi.
const profileRow = (id) => [{ text: '👤 Profilini ochish', url: `tg://user?id=${id}` }];
const PRIVACY_ERR = /BUTTON_USER_PRIVACY_RESTRICTED|USER_PRIVACY|button_user/i;
async function sendToHost(hostId, text, guestId, rows = []) {
  const withBtn = guestId && Number(guestId) !== Number(hostId);
  let m = await tg('sendMessage', {
    chat_id: hostId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: ik(withBtn ? [...rows, profileRow(guestId)] : rows),
  });
  if (!m.ok && withBtn && PRIVACY_ERR.test(m.description || '')) {
    m = await tg('sendMessage', {
      chat_id: hostId, parse_mode: 'HTML', disable_web_page_preview: true,
      text: text + `\n\n🔒 <i>Bu odam profilini yopgan — profiliga o'tib bo'lmaydi. Shu xabarga <b>reply</b> qilsangiz, javobingiz bot orqali unga yetadi.</i>`,
      reply_markup: ik(rows),
    });
  }
  if (m.ok && withBtn) await L.addRelay(hostId, m.result.message_id, guestId);
  return m;
}
async function editHostCard(chatId, messageId, text, rows, guestId) {
  const withBtn = guestId && Number(guestId) !== Number(chatId);
  let r = await tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: ik(withBtn ? [...rows, profileRow(guestId)] : rows) });
  if (!r.ok && withBtn && PRIVACY_ERR.test(r.description || '')) {
    r = await tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: ik(rows) });
  }
  return r;
}
function hostCard(r, title = '💌 <b>Yangi taklif!</b>') {
  return [
    title, '',
    `👤 ${guestLabel(r)}`,
    LINE,
    L.placeLine(r),
    `📅 ${L.prettyDate(r.date)}`,
    `${timeIcon(r.time)} soat <b>${r.time}</b>`,
    r.note ? `💭 <i>${esc(r.note)}</i>` : null,
    LINE,
    `${r.source === 'bot' ? '🤖 Botdan' : '🌐 Saytdan'}  ·  ${STATUS[r.status]}`,
  ].filter((x) => x !== null).join('\n');
}
function hostRows(r) {
  if (r.status === 'pending') {
    const rows = [[btn('✅ Qabul qilish', `ok|${r.id}`), btn('❌ Rad etish', `no|${r.id}`)]];
    if (r.guestChatId) rows.push([btn('🚫 Bloklash', `bl|${r.id}`)]);
    return rows;
  }
  if (r.status === 'approved') return [[btn('💔 Bekor qilish', `cx|${r.id}`)]];
  return [];
}
async function notifyHostNew(r) {
  await sticker(r.hostId, 'newreq');
  const m = await sendToHost(r.hostId, hostCard(r), r.guestChatId, hostRows(r));
  if (m.ok) await L.setOwnerMsg(r.id, m.result.message_id);
}
async function notifyGuest(r) {
  if (!r.guestChatId) return;
  const c = r.guestChatId;
  const ism = await hostName(r.hostId);
  if (r.status === 'approved') {
    await sticker(c, 'approved');
    await send(c, approvedText(r, ism), { reply_markup: ik([[btn('📋 Mening takliflarim', 'my')]]) });
  } else if (r.status === 'declined') {
    await sticker(c, 'declined');
    await send(c, declinedText(r, ism), { reply_markup: ik([[btn('🔄 Boshqa vaqt tanlash', `again|${r.id}`)]]) });
  } else if (r.status === 'cancelled') {
    await sticker(c, 'cancelled');
    await send(c, `💔 ${esc(ism)} bilan ${L.prettyDate(r.date)}, soat ${r.time} dagi uchrashuv bekor qilindi.\n\nHech qisi yo'q — yangisini belgilash mumkin 🙂`,
      { reply_markup: ik([[btn('🔄 Boshqa vaqt tanlash', `again|${r.id}`)]]) });
  }
}
async function listHost(chatId, where, params, emptyText, title) {
  const list = await L.listRequests(`host_id = ? AND ${where}`, [chatId, ...params], 15);
  if (!list.length) return send(chatId, emptyText);
  await send(chatId, title);
  for (const r of list) await sendToHost(chatId, hostCard(r, `${L.placeLine(r)} · ${L.shortDate(r.date)} ${r.time}`), r.guestChatId, hostRows(r));
}
async function daysManage(hostId) {
  const rows = chunk((await L.days(hostId)).map((x) => {
    const icon = !x.workday ? '💤' : x.blocked ? '🔒' : '🟢';
    return btn(`${icon} ${L.shortDate(x.date)}`, `bk|${x.date}`);
  }), 2);
  return {
    text: `🔒 <b>Kunlarni boshqarish</b>\n\n🟢 ochiq  ·  🔒 yopiq  ·  💤 dam olish kuni\n\nYopilgan kunga sizni hech kim taklif qila olmaydi.\nKunni bossangiz ochiladi / yopiladi 👇`,
    kb: ik(rows),
  };
}
async function blockedScreen(hostId) {
  const list = await L.listBlocked(hostId);
  if (!list.length) return { text: '🚫 <b>Bloklanganlar</b>\n\nHech kim bloklanmagan 🙂', kb: ik([[btn('⬅️ Orqaga', 'home')]]) };
  return {
    text: `🚫 <b>Bloklanganlar</b>\n\nBu odamlar sizga taklif yubora olmaydi.\nBlokdan chiqarish uchun bosing 👇`,
    kb: ik([...list.map((u) => [btn(`↩️ ${u.name || 'Nomsiz'}${u.username ? ' @' + u.username : ''}`, `ub|${u.id}`)]), [btn('⬅️ Orqaga', 'home')]]),
  };
}

// ================= Admin: matnlar, stikerlar, statistika =================
const T = () => L.S.texts;
const edited = (key) => (T().common?.[key] !== undefined ? '✏️ ' : '');
function textsMenu() {
  const X = L.TEXTS;
  const rows = [];
  rows.push([btn('— 🌐 SAYT —', 'tx|noop')]);
  rows.push([btn(edited('site_title') + X.site_title.label.replace('🌐 ', ''), 'tk|site_title'), btn(edited('site_sub') + X.site_sub.label.replace('🌐 ', ''), 'tk|site_sub')]);
  rows.push([btn('— 🤖 BOT XABARLARI —', 'tx|noop')]);
  rows.push([btn(edited('welcome') + X.welcome.label, 'tk|welcome'), btn(edited('note_ask') + X.note_ask.label, 'tk|note_ask')]);
  rows.push([btn(edited('waiting') + X.waiting.label, 'tk|waiting'), btn(edited('declined') + X.declined.label, 'tk|declined')]);
  rows.push([btn('— 📍 JOYLAR (nomi va tasdiqlash xabari) —', 'tx|noop')]);
  rows.push(...chunk(Object.entries(PLACES).map(([k, p]) => btn(`${T()[k] ? '✏️ ' : ''}${p.emoji} ${L.pname(k)}`, `tx|${k}`)), 2));
  rows.push([btn(`${T()._signoff !== undefined ? '✏️ ' : ''}✍️ Yakuniy imzo`, 'tx|_signoff')]);
  return {
    text: `✍️ <b>Matnlar</b> <i>(hamma foydalanuvchilar uchun umumiy)</i>\n\nTugmani bosing → hozirgi matnni ko'rasiz → <b>✏️ O'zgartirish</b>.\n\n✏️ — siz o'zgartirgan matnlar.\n<code>{ism}</code> — taklif qilinayotgan odamning ismi bilan almashtiriladi.`,
    kb: ik(rows),
  };
}
function textsKey(key) {
  const t = L.TEXTS[key];
  const rows = [[btn('✏️ O\'zgartirish', `te|t|${key}`)]];
  if (T().common?.[key] !== undefined) rows.push([btn('↩️ Standartga qaytarish', `tr|t|${key}`)]);
  rows.push([btn('⬅️ Matnlar', 'tx|menu')]);
  const raw = T().common?.[key] ?? t.def();
  return { text: `${t.label}\n<i>${esc(t.hint)}</i>\n\n<b>Hozirgi matn:</b>\n${esc(raw)}`, kb: ik(rows) };
}
function textsPlace(k) {
  const ism = L.firstName(CFG.ownerName);
  const sample = { place: k, placeText: k === 'other' ? 'Joy nomi' : '', date: L.now().date, time: '19:00', note: '' };
  const rows = [
    [btn('✏️ Joy nomi', `te|name|${k}`)],
    [btn('✏️ Kursiv qator', `te|vibe|${k}`), btn('✏️ Asosiy gap', `te|closing|${k}`)],
    [btn('✏️ Yakuniy imzo', 'te|signoff|_')],
  ];
  if (T()[k]) rows.push([btn('↩️ Standartga qaytarish', `tr|${k}`)]);
  rows.push([btn('⬅️ Matnlar', 'tx|menu')]);
  return { text: `${PLACES[k].emoji} <b>Joy nomi:</b> ${esc(L.pname(k))}\n<i>(sayt va botdagi joy tugmasida shunday ko'rinadi)</i>\n\n👀 <b>Tasdiqlash xabari mehmonga shunday boradi:</b>\n\n${approvedText(sample, ism)}`, kb: ik(rows) };
}
function textsSignoff() {
  const rows = [[btn('✏️ O\'zgartirish', 'te|signoff|_')]];
  if (T()._signoff !== undefined) rows.push([btn('↩️ Standartga qaytarish', 'tr|_signoff')]);
  rows.push([btn('⬅️ Matnlar', 'tx|menu')]);
  return { text: `✍️ <b>Yakuniy imzo</b> (har bir tasdiqlash xabari oxirida)\n<i>{ism} — taklifni qabul qilgan odamning ismi</i>\n\nHozir:\n${esc(T()._signoff ?? L.DEFAULT_SIGNOFF)}`, kb: ik(rows) };
}
const TEXT_LABEL = { name: 'Joy nomi', vibe: 'Kursiv qator', closing: 'Asosiy gap', signoff: 'Yakuniy imzo', t: 'Matn' };
function stickersScreen() {
  const lines = Object.entries(STICKERS).map(([k, s]) => `${L.S.stickers[k] ? '🖼' : '▫️'} ${s.label}`);
  const rows = Object.entries(STICKERS).filter(([k]) => L.S.stickers[k])
    .map(([k, s]) => [btn(`↩️ ${s.label} — standartga qaytarish`, `sr|${k}`)]);
  return {
    text:
      `🎨 <b>Stikerlar</b> <i>(hamma uchun umumiy)</i>\n\n${lines.join('\n')}\n\n🖼 — o'zingiz qo'ygan stiker\n▫️ — standart animatsion emoji\n\n` +
      `👉 <b>Menga istalgan stikerni yuboring</b> — keyin uni qaysi holatda ishlatishni tanlaysiz.`,
    kb: ik(rows),
  };
}
async function statsText() {
  const [t] = await L.q(`SELECT COUNT(*) AS total, SUM(status="approved") AS ok, SUM(status="pending") AS pend,
    SUM(status="declined") AS decl, SUM(status="cancelled") AS cx FROM requests`);
  const [u] = await L.q('SELECT COUNT(*) AS users, SUM(slug IS NOT NULL) AS hosts, SUM(since > NOW() - INTERVAL 7 DAY) AS week FROM users');
  const top = (await L.q('SELECT place, COUNT(*) AS n FROM requests GROUP BY place ORDER BY n DESC LIMIT 3'))
    .map((r) => `${PLACES[r.place]?.emoji || '✨'} ${L.pname(r.place)} — ${r.n}`).join('\n') || '—';
  return `📊 <b>Statistika</b> <i>(butun bot)</i>\n\n👥 Foydalanuvchilar: <b>${u.users || 0}</b> (7 kunda yangi: ${u.week || 0})\n🔗 Havola olganlar: <b>${u.hosts || 0}</b>\n\n💌 Jami takliflar: <b>${t.total || 0}</b>\n✅ Qabul qilingan: <b>${t.ok || 0}</b>\n⏳ Kutilmoqda: <b>${t.pend || 0}</b>\n❌ Rad etilgan: <b>${t.decl || 0}</b>\n💔 Bekor qilingan: <b>${t.cx || 0}</b>\n\n<b>Eng sevimli joylar:</b>\n${top}`;
}

// ================= Raqam so'rash (username'i yo'q mehmon) =================
const CONTACT_KB = {
  keyboard: [[{ text: '📱 Raqamimni ulashish', request_contact: true }], [{ text: '⏭ Kerak emas' }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};
async function askPhone(chatId, from, ism) {
  const u = await L.getUser(chatId);
  if (from.username || u?.phone || u?.phoneAsked) return;
  await L.markPhoneAsked(chatId);
  await send(chatId, `📱 <b>Bir iltimos</b>\n\nTelegram'da username'ingiz yo'q ekan. ${esc(ism)} siz bilan bog'lana olishi uchun raqamingizni ulashasizmi?\n\n👇 Pastdagi tugmani bosing`, { reply_markup: CONTACT_KB });
}
// Mehmonning oxirgi taklifi qaysi odamga ketgan — erkin xabarlar o'shanga yetkaziladi
async function lastHostOf(guestId) {
  const [r] = await L.q('SELECT host_id FROM requests WHERE guest_id = ? AND created_at > NOW() - INTERVAL 30 DAY ORDER BY created_at DESC LIMIT 1', [guestId]);
  return r ? Number(r.host_id) : null;
}

// ================= Xabarlar =================
const MENU = ['📅 bugun', '🗓 kelgusi', '🔗 havolam', '🔒 kunlar', '📋 takliflarim', '🎨 stikerlar', '✍️ matnlar', '📊 statistika'];

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  if (msg.chat.type !== 'private') return;
  const from = msg.from || {};
  const text = (msg.text || '').trim();
  const [cmdRaw, arg] = text.split(/\s+/, 2);
  const cmd = (cmdRaw || '').split('@')[0].toLowerCase();
  const key = cmd.startsWith('/') ? cmd : text.toLowerCase();
  const st = getState(chatId);
  const admin = isAdmin(chatId);

  const { user, isNew } = await L.touchUser(from, msg.message_id);
  if (isNew && !admin && CFG.ownerChatId) {
    await send(CFG.ownerChatId, `👋 Botga yangi foydalanuvchi qo'shildi: ${whoIs({ ...from, name: fullName(from) })}`);
  }

  // ---- Raqam ulashildi ----
  if (msg.contact) {
    if (msg.contact.user_id !== from.id) {
      return send(chatId, '🙂 Iltimos, o\'zingizning raqamingizni ulashing — pastdagi tugma orqali.', { reply_markup: CONTACT_KB });
    }
    let phone = String(msg.contact.phone_number || '').replace(/[^\d+]/g, '');
    if (phone && !phone.startsWith('+')) phone = '+' + phone;
    await L.setPhone(chatId, phone);
    const hosts = await L.q('SELECT DISTINCT host_id FROM requests WHERE guest_id = ? AND status IN ("pending","approved")', [chatId]);
    for (const h of hosts) {
      await sendToHost(Number(h.host_id), `📱 <b>${esc(fullName(from))}</b> raqamini ulashdi: <code>${esc(phone)}</code> · 🆔 <code>${chatId}</code>`, chatId);
      const [first, ...rest] = fullName(from).split(' ');
      await tg('sendContact', { chat_id: Number(h.host_id), phone_number: phone, first_name: first, last_name: rest.join(' ') || undefined });
    }
    return send(chatId, '✅ Rahmat! Raqamingiz yetkazildi 🤍', { reply_markup: { remove_keyboard: true } });
  }
  if (text === '⏭ Kerak emas') {
    const h = await lastHostOf(chatId);
    if (h) await sendToHost(h, `🙅 ${whoIs({ ...from, name: fullName(from) })} raqamini ulashmadi.`, chatId);
    return send(chatId, 'Mayli 🙂 Javob shu yerga keladi.', { reply_markup: { remove_keyboard: true } });
  }

  // ---- Havola egasi mehmonga javob yozyapti (yetkazilgan xabarga reply) ----
  if (msg.reply_to_message) {
    const guest = await L.getRelay(chatId, msg.reply_to_message.message_id);
    if (guest) {
      await send(guest, `💌 <b>${esc(L.firstName(user.name))}</b>:`);
      const c = await tg('copyMessage', { chat_id: guest, from_chat_id: chatId, message_id: msg.message_id });
      return send(chatId, c.ok ? '✅ Yuborildi' : '⚠️ Yuborib bo\'lmadi (u botni bloklagan bo\'lishi mumkin)');
    }
  }

  // ---- Admin: stiker o'rnatish va matn tahrirlash ----
  if (admin && msg.sticker) {
    st.pendingSticker = msg.sticker.file_id;
    const rows = chunk(Object.entries(STICKERS).map(([k, s]) => btn(s.label, `st|${k}`)), 2);
    return send(chatId, '🎨 Zo\'r stiker! Qaysi holatda ishlatamiz?', { reply_markup: ik(rows), reply_to_message_id: msg.message_id });
  }
  if (admin && st.step?.startsWith('edit:') && text && !text.startsWith('/') && !MENU.includes(key)) {
    const [, field, k] = st.step.split(':');
    st.step = null;
    const val = text.slice(0, field === 'name' ? 40 : 600);
    if (field === 't') {
      T().common = { ...(T().common || {}), [k]: val };
      await L.saveSetting('texts');
      await send(chatId, `✅ <b>${L.TEXTS[k].label}</b> saqlandi!` + (L.TEXTS[k].group === 'site' ? '\n🌐 Saytni yangilasangiz (F5) ko\'rinadi.' : ''));
      const x = textsKey(k);
      return send(chatId, x.text, { reply_markup: x.kb });
    }
    if (field === 'signoff') T()._signoff = val;
    else T()[k] = { ...(T()[k] || {}), [field]: val };
    await L.saveSetting('texts');
    const x = field === 'signoff' && !st.textPlace ? textsSignoff() : textsPlace(st.textPlace || 'park');
    await send(chatId, `✅ <b>${TEXT_LABEL[field]}</b> saqlandi!`);
    return send(chatId, x.text, { reply_markup: x.kb });
  }
  if (MENU.includes(key) || key.startsWith('/')) { if (st.step && st.step !== 'note' && st.step !== 'place') st.step = null; }

  // ---- /start bilan kelgan havolalar ----
  if (cmd === '/start' && arg) {
    // h_<nom> — kimdir shu odamni taklif qilmoqchi
    if (arg.startsWith('h_')) {
      const host = await L.getHostBySlug(arg.slice(2));
      if (!host) {
        const x = await hostHome(user);
        return send(chatId, '🤔 Bu havola topilmadi. Havolani yuborgan odamdan qayta so\'rang.\n\n' + x.text, { reply_markup: x.kb });
      }
      if (host.id === chatId) {
        const x = await hostHome(user, false);
        return send(chatId, '🙂 Bu sizning o\'zingizning havolangiz — uni do\'stlaringizga yuboring.\n\n' + x.text, { reply_markup: x.kb });
      }
      if (await L.isBlocked(host.id, chatId)) return send(chatId, '😔 Hozircha bu odamga taklif yuborib bo\'lmaydi.');
      await startGuestFlow(st, host);
      await sticker(chatId, 'welcome');
      const x = S.guestHome(L.firstName(user.name), st.draft.hostName);
      return send(chatId, x.text, { reply_markup: x.kb });
    }
    // d_<token> — saytda joy va vaqt tanlangan, shu yerda tasdiqlanadi
    if (arg.startsWith('d_')) {
      const d = await L.takeDraft(arg.slice(2));
      await sticker(chatId, 'welcome');
      if (!d) {
        const x = await hostHome(user);
        return send(chatId, '⌛ <b>Havola eskirgan</b>\n\nSaytni qaytadan ochib, vaqtni yana tanlang.\n\n' + x.text, { reply_markup: x.kb });
      }
      const host = await L.getUser(d.hostId);
      if (!host) return send(chatId, '🤔 Bu odam topilmadi.');
      if (host.id === chatId) {
        const x = await hostHome(user, false);
        return send(chatId, '🙂 Bu sizning o\'zingizning sahifangiz — o\'zingizni taklif qila olmaysiz.\n\n' + x.text, { reply_markup: x.kb });
      }
      if (await L.isBlocked(host.id, chatId)) return send(chatId, '😔 Hozircha bu odamga taklif yuborib bo\'lmaydi.');
      await startGuestFlow(st, host);
      Object.assign(st.draft, { place: d.place, placeText: d.placeText, note: d.note, date: d.date, time: d.time });
      if (!(await L.slotsFor(d.hostId, d.date)).some((s) => s.time === d.time && s.available)) {
        const x = await S.time(st.draft);
        return send(chatId, `😔 <b>${d.time} band bo'lib qoldi</b>\n\nBoshqa vaqtni tanlang 👇\n\n` + x.text, { reply_markup: x.kb });
      }
      const x = S.confirm(st.draft);
      return send(chatId, `🌸 <b>Salom, ${esc(L.firstName(user.name))}!</b> Saytda tanlaganingiz:\n\n` + x.text, { reply_markup: x.kb });
    }
  }

  // ---- Menyu ----
  const n = L.now();
  switch (key) {
    case '/start':
    case '/menu':
    case '/havolam':
    case '🔗 havolam': {
      st.step = null;
      if (cmd === '/start') await sticker(chatId, 'welcome');
      const x = await hostHome(user, cmd === '/start');
      await send(chatId, x.text, { reply_markup: x.kb });
      if (cmd === '/start') {
        return send(chatId, admin
          ? '👑 Siz adminsiz: pastdagi menyuda <b>🎨 Stikerlar</b>, <b>✍️ Matnlar</b> va <b>📊 Statistika</b> ham bor.'
          : '👇 Pastdagi menyu orqali uchrashuvlaringizni boshqarasiz.', { reply_markup: HOST_KB(admin) });
      }
      return;
    }
    case '/bugun':
    case '📅 bugun':
      return listHost(chatId, 'date = ? AND status IN ("pending","approved")', [n.date], '🌙 Bugun uchrashuv yo\'q.', `📅 <b>Bugun — ${L.prettyDate(n.date)}</b>`);
    case '/kelgusi':
    case '🗓 kelgusi':
      return listHost(chatId, 'date >= ? AND status IN ("pending","approved")', [n.date], '🌙 Kelgusi uchrashuvlar yo\'q.\n\nHavolangizni do\'stlaringizga yuboring — 🔗 Havolam', '🗓 <b>Kelgusi uchrashuvlar</b>');
    case '/kunlar':
    case '🔒 kunlar': { const x = await daysManage(chatId); return send(chatId, x.text, { reply_markup: x.kb }); }
    case '/uchrashuvlarim':
    case '/takliflarim':
    case '📋 takliflarim': { const x = await S.my(chatId); return send(chatId, x.text, { reply_markup: x.kb }); }
  }
  if (admin) {
    switch (key) {
      case '/matnlar':
      case '✍️ matnlar': { st.step = null; const x = textsMenu(); return send(chatId, x.text, { reply_markup: x.kb }); }
      case '/stikerlar':
      case '🎨 stikerlar': { const x = stickersScreen(); return send(chatId, x.text, { reply_markup: x.kb }); }
      case '/statistika':
      case '📊 statistika':
        return send(chatId, await statsText());
    }
  }

  // ---- Yozish kutilayotgan qadamlar ----
  if (st.step === 'slug' && text) {
    const res = await L.changeSlug(chatId, text);
    if (res.error) return send(chatId, `⚠️ ${esc(res.error)}\n\nBoshqa nom yozing yoki bekor qiling.`, { reply_markup: ik([[btn('✖️ Bekor qilish', 'home')]]) });
    st.step = null;
    const x = await hostHome(await L.getUser(chatId), false);
    return send(chatId, '✅ Havola nomi o\'zgardi!\n\n' + x.text, { reply_markup: x.kb });
  }
  if (st.step === 'place' && text && st.draft.host) {
    st.draft.place = 'other';
    st.draft.placeText = text.slice(0, 60);
    st.step = null;
    const x = await S.day(st.draft);
    return send(chatId, x.text, { reply_markup: x.kb });
  }
  if (st.step === 'note' && text && st.draft.host) {
    st.draft.note = text.slice(0, 300);
    st.step = null;
    const x = S.confirm(st.draft);
    return send(chatId, x.text, { reply_markup: x.kb });
  }

  // ---- Boshqa har qanday xabar — oxirgi taklif yuborilgan odamga yetkaziladi ----
  const h = await lastHostOf(chatId);
  if (h && h !== chatId) {
    await sendToHost(h, `💬 ${whoIs({ ...from, name: fullName(from), phone: user.phone })} yozdi 👇\n<i>↩️ Javob berish uchun xabarga reply qiling</i>`, chatId);
    const f = await tg('forwardMessage', { chat_id: h, from_chat_id: chatId, message_id: msg.message_id });
    if (f.ok) await L.addRelay(h, f.result.message_id, chatId);
    return send(chatId, `📨 Xabaringiz <b>${esc(await hostName(h))}</b>ga yetkazildi!`);
  }
  return send(chatId, '🤖 Pastdagi menyudan tanlang 👇', { reply_markup: HOST_KB(admin) });
}

// ================= Tugmalar =================
// Holatni o'zgartirish — faqat kutilgan holatda bo'lsa (ikki marta bosilsa yoki boshqa jarayon ulgurgan bo'lsa ham xato bo'lmaydi)
async function changeStatus(r, to, from, cq, extra = {}) {
  const res = await L.q('UPDATE requests SET status = ?, cancelled_by = COALESCE(?, cancelled_by), updated_at = NOW() WHERE id = ? AND status = ?',
    [to, extra.cancelledBy || null, r.id, from]);
  if (!res.affectedRows) return false;
  r.status = to;
  if (cq) {
    await editHostCard(cq.message.chat.id, cq.message.message_id,
      hostCard(r, cq.message.text?.startsWith('💌') ? '💌 <b>Taklif</b>' : `${L.placeLine(r)} · ${L.shortDate(r.date)} ${r.time}`), hostRows(r), r.guestChatId);
  }
  if (!extra.silent) await notifyGuest(r);
  return true;
}

async function handleCallback(cq) {
  const chatId = cq.message?.chat.id;
  const mid = cq.message?.message_id;
  const parts = String(cq.data || '').split('|');
  const [a, b] = parts;
  const st = getState(chatId);
  let alert = '';
  const show = (s) => edit(chatId, mid, s.text, s.kb);
  const me = (await L.touchUser(cq.from)).user;

  try {
    // ---- Taklif kartasidagi tugmalar: faqat havola egasi ----
    if (['ok', 'no', 'cx', 'bl'].includes(a)) {
      const r = await L.getRequest(b);
      if (!r) { alert = 'Taklif topilmadi'; return; }
      if (r.hostId !== cq.from.id) { alert = '🚫 Ruxsat yo\'q'; return; }
      if (a === 'ok') { alert = (await changeStatus(r, 'approved', 'pending', cq)) ? '✅ Qabul qilindi' : `Holat: ${STATUS[r.status]}`; return; }
      if (a === 'no') { alert = (await changeStatus(r, 'declined', 'pending', cq)) ? '❌ Rad etildi' : `Holat: ${STATUS[r.status]}`; return; }
      if (a === 'cx') { alert = (await changeStatus(r, 'cancelled', 'approved', cq, { cancelledBy: 'host' })) ? '💔 Bekor qilindi' : `Holat: ${STATUS[r.status]}`; return; }
      if (a === 'bl' && r.guestChatId) {
        await L.blockGuest(r.hostId, r.guestChatId);
        await changeStatus(r, 'declined', 'pending', cq);
        alert = '🚫 Bloklandi — bu odam sizga boshqa taklif yubora olmaydi';
        return;
      }
      return;
    }

    // ---- Havola egasi: kunlar, havola nomi, bloklanganlar ----
    if (a === 'bk') {
      const x = (await L.days(chatId)).find((d) => d.date === b);
      if (x && !x.workday) { alert = '💤 Bu kun hamma uchun dam olish kuni'; return; }
      alert = (await L.toggleDay(chatId, b)) ? '🔒 Yopildi' : '🟢 Ochildi';
      return show(await daysManage(chatId));
    }
    if (a === 'sl') {
      st.step = 'slug';
      const cur = await L.ensureSlug(me);
      return edit(chatId, mid,
        `✏️ <b>Havola nomini o'zgartirish</b>\n\nHozir: <code>${esc(shareLink(cur))}</code>\n\n👇 Yangi nomni yozib yuboring.\nFaqat lotin harflari, raqam va <code>_</code> (3–32 belgi).\nMasalan: <code>madina_23</code>\n\n⚠️ Eski havola ishlamay qoladi.`,
        ik([[btn('✖️ Bekor qilish', 'home')]]));
    }
    if (a === 'bls') return show(await blockedScreen(chatId));
    if (a === 'ub') {
      await L.unblockGuest(chatId, Number(b));
      alert = '↩️ Blokdan chiqarildi';
      return show(await blockedScreen(chatId));
    }
    if (a === 'home') { st.step = null; return show(await hostHome(me, false)); }
    if (a === 'me') { st.step = null; st.draft = {}; return show(await hostHome(me)); }

    // ---- Admin amallari ----
    if (['st', 'sr', 'tx', 'te', 'tr', 'tc', 'tk'].includes(a)) {
      if (!isAdmin(cq.from.id)) { alert = '🚫 Ruxsat yo\'q'; return; }
      if (a === 'tk') { st.textPlace = null; st.textKey = b; return show(textsKey(b)); }
      if (a === 'tx') {
        if (b === 'noop') return;
        if (b === 'menu') { st.textPlace = null; st.textKey = null; return show(textsMenu()); }
        st.textKey = null;
        if (b === '_signoff') { st.textPlace = null; return show(textsSignoff()); }
        st.textPlace = b;
        return show(textsPlace(b));
      }
      if (a === 'te' && b === 't') {
        const k = parts[2];
        st.step = `edit:t:${k}`;
        st.textKey = k;
        return edit(chatId, mid,
          `✏️ <b>${L.TEXTS[k].label}</b>\n<i>${esc(L.TEXTS[k].hint)}</i>\n\nHozirgi matn:\n<i>${esc(T().common?.[k] ?? L.TEXTS[k].def())}</i>\n\n👇 <b>Yangi matnni yozib yuboring</b> (emoji va bir necha qator ham bo'ladi)`,
          ik([[btn('✖️ Bekor qilish', 'tc|_')]]));
      }
      if (a === 'te') {
        const [field, k] = [b, parts[2]];
        st.step = `edit:${field}:${k}`;
        const cur = field === 'signoff' ? (T()._signoff ?? L.DEFAULT_SIGNOFF) : field === 'name' ? L.pname(k) : field === 'vibe' ? L.vibe(k) : L.closing(k);
        const where = field === 'signoff' ? 'barcha joylar uchun' : `${PLACES[k].emoji} ${L.pname(k)} uchun`;
        return edit(chatId, mid,
          `✏️ <b>${TEXT_LABEL[field]}</b> — ${where}\n\nHozirgi matn:\n<i>${esc(cur)}</i>\n\n👇 <b>Yangi matnni yozib yuboring</b> (emoji ham qo'shsa bo'ladi)` +
          (field === 'signoff' ? '\n\n💡 Bir necha qatorli bo\'lishi mumkin. «—» bilan boshlangan oxirgi qator kursiv bo\'ladi. <code>{ism}</code> — qabul qilgan odamning ismi.' : ''),
          ik([[btn('✖️ Bekor qilish', 'tc|_')]]));
      }
      if (a === 'tc') {
        st.step = null;
        return show(st.textKey ? textsKey(st.textKey) : st.textPlace ? textsPlace(st.textPlace) : textsMenu());
      }
      if (a === 'tr' && b === 't') {
        if (T().common) delete T().common[parts[2]];
        await L.saveSetting('texts');
        alert = '↩️ Standartga qaytdi';
        return show(textsKey(parts[2]));
      }
      if (a === 'tr') {
        if (b === '_signoff') delete T()._signoff; else delete T()[b];
        await L.saveSetting('texts');
        alert = '↩️ Standartga qaytdi';
        return show(b === '_signoff' ? textsSignoff() : textsPlace(b));
      }
      if (a === 'st') {
        if (!st.pendingSticker) { alert = 'Avval stiker yuboring'; return; }
        L.S.stickers[b] = st.pendingSticker;
        st.pendingSticker = null;
        await L.saveSetting('stickers');
        alert = '✅ Saqlandi';
        return edit(chatId, mid, `✅ Bu stiker endi <b>${STICKERS[b].label}</b> holatida yuboriladi.`, ik([]));
      }
      if (a === 'sr') {
        delete L.S.stickers[b];
        await L.saveSetting('stickers');
        alert = '↩️ Standartga qaytdi';
        return show(stickersScreen());
      }
      return;
    }

    // ---- Mehmon: taklif yuborish qadamlari ----
    const d = st.draft;
    const needHost = async () => {
      if (d.host) return true;
      await show(await hostHome(me));
      alert = 'Kimni taklif qilmoqchisiz? Uning havolasini oching 🙂';
      return false;
    };
    switch (a) {
      case 'ghome': {
        st.step = null;
        if (!d.host) return show(await hostHome(me));
        st.draft = { host: d.host, hostName: d.hostName };
        return show(S.guestHome(L.firstName(me.name), d.hostName));
      }
      case 'my':
        return show(await S.my(chatId));
      case 'go':
        if (!(await needHost())) return;
        st.step = null;
        if (b === 'place') { st.draft = { host: d.host, hostName: d.hostName }; return show(S.place(st.draft)); }
        if (!d.place) return show(S.place(d));
        if (b === 'day') return show(await S.day(d));
        if (b === 'time' && d.date) return show(await S.time(d));
        return show(await S.day(d));
      case 'pl':
        if (!(await needHost())) return;
        if (b === 'other') { st.step = 'place'; return show(S.placeAsk()); }
        st.draft = { host: d.host, hostName: d.hostName, place: b };
        alert = `${PLACES[b]?.emoji} ${L.pname(b)}`;
        return show(await S.day(st.draft));
      case 'dy':
        if (!(await needHost())) return;
        if (!d.place) return show(S.place(d));
        if (!(await L.slotsFor(d.host, b)).some((s) => s.available)) { alert = '😔 Bu kunda bo\'sh vaqt qolmadi'; return show(await S.day(d)); }
        d.date = b;
        return show(await S.time(d));
      case 'tm':
        if (!(await needHost())) return;
        if (!d.date) return show(S.place(d));
        if (!(await L.slotsFor(d.host, d.date)).some((s) => s.time === b && s.available)) { alert = '⏰ Bu vaqt band bo\'lib qoldi'; return show(await S.time(d)); }
        d.time = b;
        st.step = 'note';
        return show(S.note());
      case 'note':
        st.step = null;
        d.note = '';
        return show(S.confirm(d));
      case 'send': {
        if (!(await needHost())) return;
        if (!d.place || !d.date || !d.time) return show(S.place(d));
        const name = fullName(cq.from);
        let r;
        try {
          r = await L.createRequest({ ...d, hostId: d.host, name, phone: me.phone || '', source: 'bot', guest: { id: chatId, name, username: cq.from.username || '', phone: me.phone || '' } });
        } catch (e) {
          alert = e.message;
          return show(e.status === 409 ? await S.time(d) : await S.my(chatId));
        }
        const ism = d.hostName;
        st.draft = { host: d.host, hostName: d.hostName };
        st.step = null;
        await edit(chatId, mid, ticket(r, '✨ <b>Taklif yuborildi!</b>', ism) + `\n\n${esc(L.txt('waiting', { ism }))}`,
          ik([[btn('📋 Mening takliflarim', 'my')]]));
        await sticker(chatId, 'sent');
        await notifyHostNew(r);
        await askPhone(chatId, cq.from, ism);
        return;
      }
      case 'gc': {
        const r = await L.getRequest(b);
        if (r && r.guestChatId === chatId && L.isActive(r)) {
          const res = await L.q('UPDATE requests SET status = "cancelled", cancelled_by = "guest", updated_at = NOW() WHERE id = ? AND status IN ("pending","approved")', [r.id]);
          if (res.affectedRows) {
            alert = '💔 Bekor qilindi';
            await sendToHost(r.hostId, `💔 ${guestLabel(r)} uchrashuvni bekor qildi:\n${L.placeLine(r)} · ${L.shortDate(r.date)} ${r.time}`, chatId);
          }
        }
        return show(await S.my(chatId));
      }
      case 'again': {
        const r = await L.getRequest(b);
        if (!r) return show(await hostHome(me));
        const host = await L.getUser(r.hostId);
        if (!host || await L.isBlocked(r.hostId, chatId)) { alert = 'Bu odamga taklif yuborib bo\'lmaydi'; return; }
        await startGuestFlow(st, host);
        Object.assign(st.draft, { place: r.place, placeText: r.placeText, note: r.note });
        return show(await S.day(st.draft));
      }
    }
  } finally {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: alert || undefined });
  }
}

// ================= Ishga tushirish =================
async function setupProfile() {
  await tg('setMyDescription', {
    description:
      `🌸 Do'stlaringiz sizni uchrashuvga taklif qilishi uchun shaxsiy havola.\n\n` +
      `🎬 Kino, 🌳 park, ☕ kafe yoki ✈️ sayohat — ular joy va vaqt tanlaydi, siz bitta tugma bilan qabul qilasiz 💌\n\n👇 «Start» ni bosing va havolangizni oling`,
  });
  await tg('setMyShortDescription', { short_description: '💌 Do\'stlaringiz sizni uchrashuvga taklif qilsin — shaxsiy havola oling' });
  const base = [
    { command: 'start', description: '🔗 Havolam va bosh menyu' },
    { command: 'kelgusi', description: '🗓 Kelgusi uchrashuvlarim' },
    { command: 'bugun', description: '📅 Bugungi uchrashuvlar' },
    { command: 'kunlar', description: '🔒 Kunlarni yopish / ochish' },
    { command: 'takliflarim', description: '📋 Men yuborgan takliflar' },
  ];
  await tg('setMyCommands', { commands: base });
  if (CFG.ownerChatId) {
    await tg('setMyCommands', {
      scope: { type: 'chat', chat_id: Number(CFG.ownerChatId) },
      commands: [...base,
        { command: 'matnlar', description: '✍️ Matnlar (admin)' },
        { command: 'stikerlar', description: '🎨 Stikerlar (admin)' },
        { command: 'statistika', description: '📊 Statistika (admin)' },
      ],
    });
  }
}

// Eslatmalar: tasdiqlangan uchrashuvdan oldin ikkala tomonga. Bir necha jarayon bo'lsa ham bir marta yuboriladi
async function checkReminders() {
  if (!CFG.remind || !CFG.token) return;
  await L.DB.init();
  await L.loadSettings();
  const n = L.now();
  const list = await L.listRequests('date = ? AND status = "approved" AND reminded = 0', [n.date], 50);
  for (const r of list) {
    const left = L.toMin(r.time) - n.min;
    if (left <= 0 || left > CFG.remind) continue;
    const res = await L.q('UPDATE requests SET reminded = 1 WHERE id = ? AND reminded = 0', [r.id]);
    if (!res.affectedRows) continue;
    const when = left >= 60 ? `${Math.round(left / 60)} soatdan` : `${left} daqiqadan`;
    const ism = await hostName(r.hostId);
    await sticker(r.hostId, 'reminder');
    await sendToHost(r.hostId, `⏰ <b>${when} keyin uchrashuv!</b>\n\n👤 ${guestLabel(r)}\n${L.placeLine(r)} · ${r.time}`, r.guestChatId);
    if (r.guestChatId) {
      await sticker(r.guestChatId, 'reminder');
      await send(r.guestChatId, ticket(r, `⏰ <b>${when} keyin ${esc(ism)} bilan uchrashuv!</b>`, ism));
    }
  }
}
function startReminders() {
  setInterval(() => checkReminders().catch((e) => console.error('Eslatma xatosi:', e.message)), 60 * 1000);
}

// Bot nomi kerak bo'lganda yo'q bo'lsa — darhol Telegram'dan olinadi
async function ensureUsername() {
  if (!botUsername && CFG.token) {
    const me = await tg('getMe');
    if (me.ok) botUsername = me.result.username;
  }
  return botUsername;
}

// Har bir yangilanish: baza tayyor → matnlar yangilanadi → suhbat holati o'qiladi → ishlanadi → holat saqlanadi
async function handleUpdate(u) {
  stats.updates++;
  stats.lastUpdateAt = new Date().toISOString();
  const chatId = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
  try {
    await L.DB.init();
    await L.loadSettings();
    await ensureUsername();
    if (chatId) SESS.set(chatId, await L.loadSession(chatId));
    if (u.message) await handleMessage(u.message);
    else if (u.callback_query) await handleCallback(u.callback_query);
  } catch (e) {
    console.error('Update xatosi:', e);
    stats.lastError = `${new Date().toISOString()} ${e.message}`;
  } finally {
    if (chatId && SESS.has(chatId)) {
      try { await L.saveSession(chatId, SESS.get(chatId)); } catch (e) { console.error('Sessiya saqlanmadi:', e.message); }
      SESS.delete(chatId);
    }
  }
}

// Webhook rejimi: shared hosting (cPanel) uchun — Telegram xabarlarni saytga o'zi yuboradi.
const webhookMode = () => CFG.botMode === 'webhook' || (CFG.botMode !== 'polling' && !!process.env.PASSENGER_APP_ENV);
const secret = () => crypto.createHash('sha256').update('wh:' + CFG.token).digest('hex').slice(0, 32);
const webhookPath = () => `/tg/${secret()}`;

async function start() {
  if (!CFG.token) return;
  const me = await tg('getMe');
  if (!me.ok) { console.error('❌ Bot token noto\'g\'ri yoki Telegramga ulanib bo\'lmadi.'); return; }
  botUsername = me.result.username;
  await setupProfile();
  startReminders();

  if (webhookMode()) {
    if (!/^https:\/\//.test(CFG.siteUrl)) { console.error('❌ Webhook uchun SITE_URL https:// bilan boshlanishi kerak'); return; }
    const url = CFG.siteUrl + webhookPath();
    const info = await tg('getWebhookInfo');
    if (info.result?.url !== url) {
      const r = await tg('setWebhook', { url, secret_token: secret(), allowed_updates: ['message', 'callback_query'] });
      console.log(r.ok ? '🔗 Webhook o\'rnatildi' : `❌ Webhook o'rnatilmadi: ${r.description}`);
      if (r.ok && CFG.ownerChatId) {
        const cronUrl = `${CFG.siteUrl}/cron/${secret().slice(0, 16)}`;
        await send(CFG.ownerChatId,
          `✅ <b>Bot hostingda ishga tushdi!</b>\n\n⏰ Eslatmalar ishlashi uchun cPanel → <b>Cron Jobs</b> ga qo'shing:\n\n• Vaqt: <b>Once Per Five Minutes (*/5)</b>\n• Buyruq (Command):\n<code>curl -s ${cronUrl} >/dev/null 2>&1</code>`);
      }
    }
    console.log(`🤖 Bot ishga tushdi (webhook): @${botUsername}`);
    return;
  }

  // Bot hostingda (webhook) ishlayotgan bo'lsa — kompyuterdagi nusxa uni o'chirib qo'ymasin
  const wh = await tg('getWebhookInfo');
  if (wh.result?.url && CFG.botMode !== 'polling') {
    console.warn(`⚠️  Bu bot hostingda ishlayapti: ${wh.result.url.replace(/\/tg\/.*/, '')}`);
    console.warn('   Kompyuterda Telegram qismi ishga tushirilmadi (sayt ishlaydi). Majburan ishga tushirish: .env ga BOT_MODE=polling');
    return;
  }
  console.log(`🤖 Bot ishga tushdi: @${botUsername}`);
  await tg('deleteWebhook');
  let offset = 0;
  for (;;) {
    const r = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] });
    for (const u of r.result || []) {
      offset = u.update_id + 1;
      await handleUpdate(u);
    }
    if (!r.ok) {
      if (/Conflict/i.test(r.description || '')) console.error('⚠️  Shu bot boshqa joyda ham ishlab turibdi (masalan, kompyuteringizda). Bittasini to\'xtating.');
      await new Promise((s) => setTimeout(s, 5000));
    }
  }
}

module.exports = { stats, start, ensureUsername, handleUpdate, checkReminders, webhookPath, secret, webhookMode, username: () => botUsername };
