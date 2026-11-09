# Ahost (cPanel) hostingga joylash — alohida domen bilan

Natija: sayt `https://SIZNING-DOMEN.uz` da ochiladi (hech qayerda `ecobiomes` yo'q),
bot 24/7 ishlaydi. Domen mavjud hostingingizga **Addon Domain** sifatida ulanadi — qo'shimcha hosting to'lovi yo'q.

Quyida `SIZNING-DOMEN.uz` o'rniga o'zingiz olgan domenni yozing.

> ℹ️ Hostingga joylagandan keyin kompyuteringizda `npm start` qilsangiz, bot buni sezadi va hostingdagi botga tegmaydi
> (faqat sayt qismi kompyuterda ochiladi). Kompyuterda botni to'liq sinash uchun boshqa (test) bot tokenidan foydalaning.

---

## 1. Domen oling

ahost.uz → domen qidirish → sotib oling.
Ahost'dan olingan domen avtomatik Ahost DNS serverlariga ulangan bo'ladi — hech narsa sozlash shart emas.

## 2. Domenni cPanel'ga qo'shing

cPanel → **Domains** (Домены) → **Create A New Domain**
- Domain: `SIZNING-DOMEN.uz`
- "Share document root" belgisini **olib tashlang**
- **Submit**

## 3. HTTPS (bepul SSL)

cPanel → **SSL/TLS Status** → yangi domenni belgilang → **Run AutoSSL**.
Bir necha daqiqada qulfcha (🔒) paydo bo'ladi. Bot uchun HTTPS **shart**.

## 4. Loyihani arxivlang (kompyuterda, PowerShell)

```powershell
cd C:\loyihalar
tar -a -cf invitation.zip --exclude=node_modules --exclude=data invitation_project
```

## 5. Fayllarni yuklang

cPanel → **File Manager** → bosh papka (`/home/...`) → **Upload** → `invitation.zip`
Keyin zip ustida o'ng tugma → **Extract**. `invitation_project` papkasi paydo bo'ladi.

## 6. `.env` ni sozlang

File Manager → `invitation_project` → `.env` → **Edit**. Quyidagilarni tekshiring/o'zgartiring:

```
SITE_URL=https://SIZNING-DOMEN.uz
BOT_MODE=webhook
SLOT_MINUTES=60
```

`BOT_TOKEN`, `OWNER_CHAT_ID`, `OWNER_NAME` — kompyuteringizdagidek qoladi. **Save**.

> `.env` ko'rinmasa: File Manager → o'ng yuqori **Settings** → "Show Hidden Files" ✅

## 7. Node.js ilovasini yarating

cPanel → **Setup Node.js App** → **Create Application**:

| Maydon | Qiymat |
|---|---|
| Node.js version | **22** (yoki 20+) |
| Application mode | **Production** |
| Application root | `invitation_project` |
| Application URL | `SIZNING-DOMEN.uz` (ro'yxatdan tanlang) |
| Application startup file | `server.js` |

**Create** → keyin pastda **Run NPM Install** → tugagach yuqorida **Restart**.

## 8. Tekshiring

1. Brauzerda `https://SIZNING-DOMEN.uz/health` → `{"ok":true,"bot":"...","mode":"webhook"}`
2. `https://SIZNING-DOMEN.uz` — sakura sayti, kunlar va vaqtlar
3. Telegram'da botingiz sizga **"✅ Bot hostingda ishga tushdi!"** xabarini yuboradi (ichida Cron buyrug'i bor)
4. Botga `/start` → 👑 boshqaruv paneli

> Bot xabar yubormasa — saytni bir marta oching (ilova birinchi so'rovda ishga tushadi).

## 9. Eslatmalar uchun Cron

Botdan kelgan xabardagi buyruqni nusxalang, keyin:
cPanel → **Cron Jobs** → Common Settings: **Once Per Five Minutes (*/5 \* \* \* \*)** → Command: botdan nusxalangan `curl -s https://.../cron/... >/dev/null 2>&1` → **Add New Cron Job**.

Bu eslatmalarni yuboradi va ilovani "uyg'oq" ushlab turadi.

---

## Kodni yangilash

1. 4-qadam (yangi `invitation.zip`)
2. File Manager → yangi zipni yuklang → Extract (**faqat kod fayllarini** almashtiring; serverdagi `.env` va `data` papkasiga tegmang)
3. Setup Node.js App → **Restart**

## Muammolar

| Belgi | Yechim |
|---|---|
| `/health` 503 yoki "Incorrect application" | Setup Node.js App → Run NPM Install → Restart |
| Sayt ochiladi, bot javob bermaydi | `.env` da `SITE_URL` aynan `https://SIZNING-DOMEN.uz` ekanini tekshiring → Restart → saytni bir marta oching |
| Bot javob bermay qoldi | Setup Node.js App → Restart, keyin saytni bir marta oching. Kompyuterda `BOT_MODE=polling` bilan ishga tushirgan bo'lsangiz — u hostingdagi botni o'chiradi |
| SSL yo'q (https ochilmaydi) | SSL/TLS Status → Run AutoSSL; domen yangi bo'lsa 15–60 daqiqa kuting |
| Xato loglari | Setup Node.js App ichida yoki File Manager → `invitation_project/stderr.log` |
