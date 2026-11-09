'use strict';
// MySQL bazasi: jadvallar avtomatik yaratiladi, eski data/db.json dagi ma'lumotlar bir marta ko'chiriladi
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { CFG } = require('./config');

let pool;
function getPool() {
  if (!pool) {
    if (!CFG.db.name || !CFG.db.user) throw new Error('MySQL sozlanmagan: .env da DB_NAME, DB_USER, DB_PASS ni yozing');
    pool = mysql.createPool({
      host: CFG.db.host, port: CFG.db.port, user: CFG.db.user, password: CFG.db.pass, database: CFG.db.name,
      charset: 'utf8mb4', waitForConnections: true, connectionLimit: 4, dateStrings: true, supportBigNumbers: true, bigNumberStrings: false,
    });
  }
  return pool;
}

async function q(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}
// Tranzaksiya: hammasi yoki hech narsa. fn ichida faqat berilgan `t` dan foydalaning
async function tx(fn) {
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    const t = async (sql, params = []) => (await c.query(sql, params))[0];
    const res = await fn(t);
    await c.commit();
    return res;
  } catch (e) {
    try { await c.rollback(); } catch {}
    throw e;
  } finally {
    c.release();
  }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    name VARCHAR(128) NOT NULL DEFAULT '',
    username VARCHAR(64) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    phone_asked TINYINT NOT NULL DEFAULT 0,
    last_msg_id INT NULL,
    slug VARCHAR(32) NULL UNIQUE,
    since DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS requests (
    id CHAR(8) PRIMARY KEY,
    token CHAR(16) NOT NULL UNIQUE,
    host_id BIGINT NOT NULL,
    guest_id BIGINT NULL,
    guest_name VARCHAR(128) NOT NULL DEFAULT '',
    guest_username VARCHAR(64) NOT NULL DEFAULT '',
    name VARCHAR(128) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    place VARCHAR(16) NOT NULL,
    place_text VARCHAR(64) NOT NULL DEFAULT '',
    note TEXT,
    date CHAR(10) NOT NULL,
    time CHAR(5) NOT NULL,
    source VARCHAR(8) NOT NULL DEFAULT 'bot',
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    owner_msg_id INT NULL,
    reminded TINYINT NOT NULL DEFAULT 0,
    cancelled_by VARCHAR(8) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    INDEX idx_host_date (host_id, date),
    INDEX idx_guest (guest_id),
    INDEX idx_date_status (date, status)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS drafts (
    token CHAR(16) PRIMARY KEY,
    host_id BIGINT NOT NULL,
    data TEXT NOT NULL,
    exp BIGINT NOT NULL
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    chat_id BIGINT PRIMARY KEY,
    data MEDIUMTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS blocked_days (
    host_id BIGINT NOT NULL,
    date CHAR(10) NOT NULL,
    PRIMARY KEY (host_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS guest_blocks (
    host_id BIGINT NOT NULL,
    guest_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (host_id, guest_id)
  )`,
  `CREATE TABLE IF NOT EXISTS relay (
    host_id BIGINT NOT NULL,
    msg_id INT NOT NULL,
    guest_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (host_id, msg_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    k VARCHAR(32) PRIMARY KEY,
    v MEDIUMTEXT NOT NULL
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

// Eski (bitta foydalanuvchili) versiyadagi data/db.json → MySQL, bir marta
async function migrateJson() {
  const file = path.join(CFG.dataDir, 'db.json');
  if (!fs.existsSync(file)) return null;
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM settings WHERE k = "migrated"');
  if (n) return null;
  let old;
  try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  const admin = Number(CFG.ownerChatId) || 0;
  let moved = 0;
  await tx(async (t) => {
    if (old.texts && Object.keys(old.texts).length) await t('REPLACE INTO settings (k, v) VALUES ("texts", ?)', [JSON.stringify(old.texts)]);
    if (old.stickers && Object.keys(old.stickers).length) await t('REPLACE INTO settings (k, v) VALUES ("stickers", ?)', [JSON.stringify(old.stickers)]);
    for (const [id, u] of Object.entries(old.users || {})) {
      await t('INSERT IGNORE INTO users (id, name, username, phone, phone_asked) VALUES (?, ?, ?, ?, ?)',
        [Number(id), u.name || '', u.username || '', u.phone || '', u.phoneAsked ? 1 : 0]);
    }
    if (admin) {
      for (const r of old.requests || []) {
        await t(`INSERT IGNORE INTO requests (id, token, host_id, guest_id, guest_name, guest_username, name, phone, place, place_text, note,
                 date, time, source, status, owner_msg_id, reminded, cancelled_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.id, r.token, admin, r.guestChatId || null, r.guest?.name || r.name || '', r.guest?.username || '', r.name || '', r.phone || '',
            r.place || 'other', r.placeText || '', r.note || '', r.date, r.time, r.source || 'web', r.status || 'pending',
            r.ownerMsgId || null, r.reminded ? 1 : 0, r.cancelledBy || null]);
        moved++;
      }
      for (const d of old.blocked || []) await t('INSERT IGNORE INTO blocked_days (host_id, date) VALUES (?, ?)', [admin, d]);
    }
    await t('REPLACE INTO settings (k, v) VALUES ("migrated", ?)', [new Date().toISOString()]);
  });
  try { fs.renameSync(file, file + '.migrated'); } catch {}
  return moved;
}

let ready;
function init() {
  if (!ready) {
    ready = (async () => {
      for (const s of SCHEMA) await q(s);
      const moved = await migrateJson();
      if (moved !== null) console.log(`📦 Eski ma'lumotlar MySQL'ga ko'chirildi (${moved} ta taklif)`);
      return true;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

module.exports = { q, tx, init, getPool };
