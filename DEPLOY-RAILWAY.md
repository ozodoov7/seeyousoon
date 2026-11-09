# Internetga joylash (Railway)

Railway'da bot 24/7 ishlaydi, sayt `https://...up.railway.app` manzilida ochiladi.
Takliflar saqlanadigan fayl o'chib ketmasligi uchun **Volume** (doimiy disk) ulanadi.

> ⚠️ Avval kompyuteringizdagi serverni to'xtating (`Ctrl+C`).
> Bitta bot ikki joyda bir vaqtda ishlay olmaydi — Telegram "Conflict" xatosini beradi.

---

## 1. Railway CLI ni o'rnating va kiring

Terminalda (PowerShell):

```
npm install -g @railway/cli
railway login
```

Brauzer ochiladi — GitHub yoki email orqali kiring.

## 2. Loyihani yarating va yuklang

```
cd C:\loyihalar\invitation_project
railway init
```

Loyiha nomini so'raydi: `invitation-project` deb yozing.

```
railway up
```

Kod yuklanadi va build boshlanadi. `.env`, `node_modules` va `data` yuklanmaydi (`.gitignore` da).

## 3. Sozlamalarni kiriting

[railway.com](https://railway.com) → loyihangiz → servisni bosing → **Variables** → **Raw Editor**.
`.env` faylingizdagi qatorlarni shu yerga nusxalab qo'ying:

```
BOT_TOKEN=...sizning tokeningiz...
OWNER_CHAT_ID=8422500397
OWNER_NAME=Javohir Ozodov
OWNER_TITLE=Qachon va qayerda ko'rishamiz? 🌸
TIMEZONE=Asia/Tashkent
WORK_DAYS=0,1,2,3,4,5,6
WORK_START=10:00
WORK_END=23:00
SLOT_MINUTES=60
DAYS_AHEAD=14
MIN_NOTICE_MINUTES=60
REMIND_MINUTES=60
DATA_DIR=/app/data
```

`PORT` ni yozmang — Railway o'zi beradi.

## 4. Doimiy disk (Volume) ulang

Servis ustida o'ng tugma (yoki `Ctrl+K`) → **Add Volume** → Mount path: `/app/data`

Bu bo'lmasa, har yangilanishda barcha takliflar o'chib ketadi.

## 5. Sayt manzilini oling

Servis → **Settings** → **Networking** → **Generate Domain**.
Masalan: `invitation-project-production.up.railway.app`

Keyin **Variables** ga qo'shing:

```
SITE_URL=https://invitation-project-production.up.railway.app
```

Railway avtomatik qayta ishga tushiradi.

## 6. Tekshiring

- `https://...up.railway.app/health` → `{"ok":true,"bot":"sizning_bot"}` chiqishi kerak
- Sayt ochiladi, kunlar va vaqtlar ko'rinadi
- Botga `/start` → 👑 boshqaruv paneli
- Botning bosh menyusida endi **🌐 Sayt orqali** tugmasi ham chiqadi

Loglarni ko'rish: `railway logs`

---

## Keyinchalik kodni yangilash

```
cd C:\loyihalar\invitation_project
railway up
```

## Eski takliflarni ko'chirish (ixtiyoriy)

Kompyuteringizdagi `data\db.json` dagi eski takliflar serverga o'tmaydi — server toza boshlanadi.
Ular sinov takliflari bo'lgani uchun buning keragi yo'q.

## Narx

- Yangi akkaunt **Trial** bilan boshlanadi: bir martalik **$5** kredit, 30 kun. Sinab ko'rish uchun yetadi.
- Trial tugagach akkaunt **Free** tarifiga o'tadi: oyiga atigi **$1** kredit. Bot doim ishlab turishi uchun bu yetmasligi mumkin.
- Doimiy ishlashi uchun **Hobby** — oyiga **$5** (ichida $5 lik foydalanish krediti bor). Bu loyiha juda kam resurs ishlatadi, odatda shu $5 ichida qoladi.

Aniq narxlar: https://railway.com/pricing
