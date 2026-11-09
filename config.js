'use strict';
// Sozlamalar: .env faylidan o'qiladi (qo'shimcha kutubxonasiz)
const fs = require('fs');
const path = require('path');

(function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

// Bo'sh qoldirilgan qator ham standart qiymatni oladi
const env = (k, d = '') => { const v = (process.env[k] ?? '').toString().trim(); return v === '' ? d : v; };
// Raqamli sozlama: noto'g'ri yoki chegaradan tashqari bo'lsa — standart qiymat
const num = (k, d, min, max) => { const n = Number(env(k, String(d))); return Number.isFinite(n) && n >= min && n <= max ? n : d; };
const timeOk = (k, d) => (/^([01]?\d|2[0-3]):[0-5]\d$/.test(env(k, d)) ? env(k, d).padStart(5, '0') : d);

const CFG = {
  token: env('BOT_TOKEN'),
  // Admin: matnlar, joy nomlari, stikerlar va umumiy statistika faqat unga ochiq
  ownerChatId: env('OWNER_CHAT_ID'),
  ownerName: env('OWNER_NAME', 'Admin'),
  ownerTitle: env('OWNER_TITLE', ''),
  siteUrl: env('SITE_URL', 'http://localhost:3000').replace(/\/$/, ''),
  // Ixtiyoriy: bosh sahifa (seeyousoon.uz) kimning sahifasini ko'rsatsin. Bo'sh — hamma uchun tanishtiruv sahifasi
  rootSlug: env('ROOT_SLUG').toLowerCase(),
  port: Number(env('PORT', '3000')),
  tz: env('TIMEZONE', 'Asia/Tashkent'),
  workDays: env('WORK_DAYS', '0,1,2,3,4,5,6').split(',').map((x) => Number(x.trim())).filter((x) => x >= 0 && x <= 6),
  workStart: timeOk('WORK_START', '10:00'),
  workEnd: timeOk('WORK_END', '23:00'),
  breakStart: env('BREAK_START') && timeOk('BREAK_START', ''),
  breakEnd: env('BREAK_END') && timeOk('BREAK_END', ''),
  slot: num('SLOT_MINUTES', 60, 10, 720),
  daysAhead: num('DAYS_AHEAD', 14, 1, 60),
  minNotice: num('MIN_NOTICE_MINUTES', 60, 0, 10080),
  remind: num('REMIND_MINUTES', 60, 0, 1440),
  maxActivePerGuest: 3,     // bitta mehmon bitta odamga bir vaqtda nechta faol taklif yubora oladi
  maxNewPerGuestDay: 10,    // bitta mehmon kuniga jami nechta taklif yubora oladi (spam himoyasi)
  botMode: env('BOT_MODE', 'auto'), // auto | polling | webhook
  db: {
    host: env('DB_HOST', 'localhost'),
    port: num('DB_PORT', 3306, 1, 65535),
    name: env('DB_NAME'),
    user: env('DB_USER'),
    pass: env('DB_PASS'),
  },
  dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
};

module.exports = { CFG };
