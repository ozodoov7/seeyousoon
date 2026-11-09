# 2-versiyaga o'tish: hamma uchun shaxsiy havola (cPanel)

Endi botga kim `/start` bossa, o'zining havolasini oladi (`seeyousoon.uz/madina`).
Do'stlari shu havola orqali uni uchrashuvga taklif qiladi. Ma'lumotlar **MySQL** bazasida saqlanadi.

Sizning eski takliflaringiz, matnlaringiz va stikerlaringiz **avtomatik ko'chiriladi** — hech narsa yo'qolmaydi.

---

## 1. MySQL baza yarating (cPanel)

cPanel → **Базы данных MySQL** (MySQL® Databases):

1. **Создать новую базу данных** → nom: `seeyou` → **Создать базу данных**
   (to'liq nomi `ecobiome_seeyou` bo'ladi)
2. Pastda **Добавить нового пользователя** → nom: `seeyou`, parol: **Password Generator** bilan kuchli parol → nusxalab oling! → **Создать пользователя**
   (to'liq nomi `ecobiome_seeyou` bo'ladi)
3. Yana pastda **Добавить пользователя в базу данных** → foydalanuvchi va bazani tanlang → **Добавить** → **ALL PRIVILEGES** ✅ → **Внести изменения**

## 2. `.env` ga baza ma'lumotlarini yozing

File Manager → `invitation_project/.env` → **Edit** → oxiriga qo'shing:

```
DB_HOST=localhost
DB_NAME=ecobiome_seeyou
DB_USER=ecobiome_seeyou
DB_PASS=1-qadamdagi parol
```

Nomlar sizning cPanel'da qanday ko'rsatilgan bo'lsa, aynan shunday yozing. **Save Changes**.

## 3. Yangi fayllarni yuklang

File Manager → `invitation_project` → **Upload** (eskisining ustidan):

- `config.js` (yangi)
- `db.js` (yangi)
- `lib.js`, `bot.js`, `server.js`, `package.json`

`invitation_project/public` → **Upload**:

- `app.js`, `index.html`, `style.css`

## 4. Kutubxonani o'rnating va qayta ishga tushiring

**Setup Node.js App** → ilovangiz → **▶ Установить NPM пакеты** (yangi `mysql2` kutubxonasi o'rnatiladi) → tugagach **Перезапустить**.

## 5. Tekshiring

- `https://seeyousoon.uz/health` → `"db":"ok"` chiqishi kerak
- `https://seeyousoon.uz` → "Do'stlaringiz sizni uchrashuvga taklif qilsin" sahifasi
- Botga `/start` → **sizning havolangiz** (`seeyousoon.uz/javohir` kabi)
- Do'stingizdan botga `/start` bosishini so'rang — u ham o'z havolasini oladi

Eski takliflaringiz `🗓 Kelgusi` da turibdi. `data/db.json` fayli `db.json.migrated` deb qayta nomlanadi (zaxira sifatida qoladi).

---

## Nima o'zgardi

| | Avval | Endi |
|---|---|---|
| Kim taklif qabul qiladi | Faqat siz | Botga `/start` bosgan har kim |
| Havola | `seeyousoon.uz` | Har kimniki: `seeyousoon.uz/ism` |
| Bosh sahifa | Sizning sahifangiz | "Havolangizni oling" tanishtiruvi |
| Matnlar, joy nomlari, stikerlar | Siz | Siz (admin) — hamma uchun umumiy |
| Statistika | Sizniki | Butun bot bo'yicha (admin) |
| Baza | JSON fayl | MySQL |

**Yangi imkoniyatlar:**
- 🔗 **Havolam** — havolangiz va "Do'stlarga yuborish" tugmasi
- ✏️ Havola nomini o'zgartirish (masalan `madina_23`)
- 🚫 **Bloklash** — taklif kartasida; bezovta qiluvchi odam boshqa taklif yubora olmaydi
- 📋 **Takliflarim** — siz boshqalarga yuborgan takliflar
- Spam himoyasi: bir odamga 3 tadan ortiq faol taklif yo'q, kuniga jami 10 tadan ortiq yo'q

**Bosh sahifada o'z sahifangiz ochilsin desangiz:** `.env` ga `ROOT_SLUG=javohir` (havolangiz nomi) yozib, qayta ishga tushiring.

## Muammolar

| Belgi | Yechim |
|---|---|
| `/health` da `"db"` xato matni | `.env` dagi DB_NAME / DB_USER / DB_PASS ni cPanel'dagi bilan solishtiring; foydalanuvchi bazaga ALL PRIVILEGES bilan qo'shilganini tekshiring |
| `Cannot find module 'mysql2'` | Setup Node.js App → Установить NPM пакеты → Перезапустить |
| Sayt "Server hozir band" deydi | Baza ulanmagan — yuqoridagi birinchi qatorni tekshiring |
