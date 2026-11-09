# O'z serveringizga joylash (Ubuntu / Debian)

Hammasini `deploy/setup.sh` skripti o'zi qiladi:
Node.js, pm2 (bot 24/7 ishlashi va server qayta yonganda o'zi ishga tushishi uchun), Nginx va — domen bo'lsa — bepul HTTPS.

> ⚠️ **Avval kompyuteringizdagi serverni to'xtating** (`Ctrl+C`).
> Bitta bot ikki joyda bir vaqtda ishlay olmaydi — Telegram "Conflict" xatosini beradi.

---

## 1. Loyihani arxivlang (Windows, PowerShell)

```powershell
cd C:\loyihalar
tar -czf invitation.tgz --exclude=node_modules --exclude=data invitation_project
```

`.env` (bot tokeni bilan) arxivga kiradi — serverga kerak. `node_modules` va `data` kirmaydi.

## 2. Serverga yuklang

`USER` — server foydalanuvchisi (ko'pincha `root`), `IP` — server manzili:

```powershell
scp C:\loyihalar\invitation.tgz USER@IP:~/
```

## 3. Serverga kiring va o'rnating

```powershell
ssh USER@IP
```

Serverda:

```bash
tar -xzf invitation.tgz
cd invitation_project
```

**A) IP orqali** (domen yo'q):
```bash
sudo bash deploy/setup.sh
```
Sayt: `http://SERVER_IP`

**B) Domen orqali** (masalan `uchrashuv.uz`):

Avval domen panelida **A yozuvi** qo'shing: `@` → server IP, `www` → server IP.
5–30 daqiqa kuting (DNS tarqalishi), keyin:
```bash
sudo bash deploy/setup.sh uchrashuv.uz
```
Sayt: `https://uchrashuv.uz` (HTTPS avtomatik)

Oxirida `✅ Tayyor!` va `{"ok":true,"bot":"sizning_bot"}` chiqishi kerak.

## 4. Tekshiring

- Saytni oching — ismingiz, kunlar va vaqtlar ko'rinadi
- Botga `/start` → 👑 boshqaruv paneli

---

## Foydali buyruqlar (serverda)

| Nima | Buyruq |
|---|---|
| Loglarni ko'rish | `pm2 logs invitation` |
| Holat | `pm2 status` |
| Qayta ishga tushirish | `pm2 restart invitation` |
| Sozlamalarni o'zgartirish | `nano /opt/invitation_project/.env`, keyin `pm2 restart invitation --update-env` |
| Takliflar fayli | `/opt/invitation_project/data/db.json` |

## Kodni yangilash

1–2-qadamlarni takrorlang (yangi arxiv → serverga), keyin serverda:

```bash
rm -rf invitation_project && tar -xzf invitation.tgz && cd invitation_project
sudo bash deploy/setup.sh            # yoki: sudo bash deploy/setup.sh uchrashuv.uz
```

Takliflar (`data/`) va serverdagi `.env` saqlanib qoladi.

## Keyinroq domen ulash

IP bilan boshlagan bo'lsangiz — domen olib, A yozuvini qo'shing va shunchaki:
```bash
sudo bash deploy/setup.sh uchrashuv.uz
```

## Muammolar

| Belgi | Yechim |
|---|---|
| Logda `Conflict` | Bot boshqa joyda ham ishlayapti (kompyuteringizda?) — u yerni to'xtating |
| `❌ Bot token noto'g'ri` | `nano /opt/invitation_project/.env` → `BOT_TOKEN` ni tekshiring |
| Sayt ochilmaydi | Hosting panelida 80/443-portlar ochiqligini tekshiring |
| HTTPS sertifikati olinmadi | Domen A yozuvi server IP siga qaraganini tekshiring (`ping uchrashuv.uz`), skriptni qayta ishga tushiring |

---

Railway'ga joylash (muqobil yo'l): [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md)
