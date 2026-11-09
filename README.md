# See you soon — uchrashuvga taklif sayti + Telegram bot

> **2-versiya:** botga `/start` bosgan har kim o'z havolasini oladi (`seeyousoon.uz/ism`), ma'lumotlar MySQL'da. O'tish yo'riqnomasi: **[YANGILASH-v2.md](YANGILASH-v2.md)**
>
> **GitHub orqali joylash:** [GITHUB-CPANEL.md](GITHUB-CPANEL.md)

Yaqinlaringiz siz bilan ko'rishish uchun joy (🎬 kino, 🌳 park, ☕ kafe, ✈️ sayohat...), kun va vaqtni tanlab taklif yuboradi — **saytdan ham, botning o'zidan ham**. Saytda ism/telefon so'ralmaydi: joy va vaqt tanlangach Telegram bot ochiladi, odam u yerda bitta tugmani bosadi va sizga uning Telegram ismi va username'i keladi.
So'rov **Telegramingizga** keladi va siz uni **✅ Tasdiqlash / ❌ Rad etish** tugmasi bilan hal qilasiz.
Mehmon ham botni ochsa, javob unga Telegramda boradi.

## Imkoniyatlar
- **Bot ichida to'liq taklif qilish**: joy → kun → vaqt → izoh → tasdiqlash (4 qadam, tugmalar bilan)
- **10 xil joy**: kinoteatr, park, kafe, restoran, sayohat, tabiat, shahar sayri, o'yin markazi, konsert, yoki o'zingiz yozgan joy
- **Stikerlar**: har bir holatda (salomlashish, yuborildi, tasdiqlandi, rad etildi, eslatma...) animatsion stiker. O'zingiznikini qo'yish uchun botga stiker yuboring
- **Egasi uchun panel**: 📅 Bugun, 🗓 Kelgusi, 🔒 Kunlar (bosib yopish/ochish), 🎨 Stikerlar, 📊 Statistika, 💌 Sinab ko'rish
- **Yozishma**: mehmon botga yozgan xabar sizga keladi, *reply* qilsangiz javobingiz unga boradi
- Mehmon o'z uchrashuvlarini ko'radi va bekor qila oladi
- Ish kunlari, ish vaqti, tushlik tanaffusi va uchrashuv davomiyligini sozlash
- Band vaqtlar avtomatik yopiladi (ikki kishi bir vaqtga yozila olmaydi)
- Telegramda tasdiqlash / rad etish / bekor qilish
- Mehmonga avtomatik javob (tasdiqlandi / rad etildi / bekor qilindi)
- Uchrashuvdan 30 daqiqa oldin ikkalangizga eslatma
- Bot buyruqlari: `/bugun`, `/kelgusi`, `/band 2026-11-15`, `/ochish 2026-11-15`, `/yopiq`
- Spam himoyasi (IP cheklovi + yashirin maydon)
- Telefon uchun moslashgan dizayn
- **3D animatsiyalar**: Three.js bilan sakura shoxlari, 3D gullar, to'kilayotgan gulbarglar va tuman (tungi pushti ranglarda), sichqonchaga qarab egiladigan karta, 3D varaqlanuvchi kunlar, tushuvchi vaqt tugmalari, qadamlar orasida 3D aylanish, aylanuvchi tanga va gulbarglar portlashi. "Harakatni kamaytirish" sozlamasi yoqilgan qurilmalarda animatsiyalar o'chadi, WebGL bo'lmasa sayt oddiy ko'rinishda ishlayveradi

## O'rnatish (5 daqiqa)

**1. Bot yarating.** Telegramda [@BotFather](https://t.me/BotFather) ga `/newbot` yozing, nom bering, tokenni nusxalang.

**2. Sozlang.**
```bash
npm install
cp .env.example .env
```
`.env` faylini oching, `BOT_TOKEN` ga tokenni, `OWNER_NAME` ga ismingizni yozing.

**3. Chat ID ni oling.**
```bash
npm start
```
Botingizga `/start` yozing — u sizning chat ID raqamingizni yuboradi.
Uni `.env` dagi `OWNER_CHAT_ID` ga yozing va serverni qayta ishga tushiring (`Ctrl+C`, keyin `npm start`).

**4. Tayyor.** Sayt: http://localhost:3000

Node.js 18 yoki undan yangi versiya kerak.

## Internetga joylash

👉 **O'z serveringiz (Ubuntu): [DEPLOY.md](DEPLOY.md)** — bitta buyruq: `sudo bash deploy/setup.sh`
👉 **cPanel hosting (Ahost va b.): [DEPLOY-CPANEL.md](DEPLOY-CPANEL.md)**
👉 Railway: [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md)

Bot "polling" rejimida ishlaydi, ya'ni domen yoki HTTPS shart emas — server doimiy ishlab tursa bo'ldi.

- **VPS** (eng ishonchli): `npm install && npm start`, doimiy ishlashi uchun `pm2 start server.js --name uchrashuv`.
- **Railway / Render**: loyihani GitHub'ga yuklang, `.env` dagi qiymatlarni "Environment variables" ga kiriting.
  Ma'lumotlar `data/db.json` faylida saqlanadi — Railway'da **Volume** ni `/app/data` ga ulang, aks holda qayta ishga tushganda yo'qoladi.

Joylagandan keyin `.env` dagi `SITE_URL` ni haqiqiy manzilga o'zgartiring (bot xabarlarida shu havola chiqadi).

## Fayllar
```
server.js          — veb-server (sayt + API)
bot.js             — Telegram bot (menyular, stikerlar, panel)
lib.js             — umumiy: sozlamalar, baza, vaqt, joylar
public/            — sayt (index.html, style.css, app.js)
data/db.json       — so'rovlar (avtomatik yaratiladi)
.env               — sozlamalar
```
