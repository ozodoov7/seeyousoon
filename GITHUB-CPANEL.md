# GitHub → cPanel: kodni GitHub orqali yangilash

Repo: **https://github.com/ozodoov7/seeyousoon** (private)

Ishlash tartibi: kod GitHub'da → cPanel uni tortib oladi → `.cpanel.yml` fayllarni `invitation_project` papkasiga ko'chiradi va ilovani qayta ishga tushiradi.

`.env` (bot tokeni, baza paroli), `data/` va `node_modules/` GitHub'ga **yuklanmaydi** va serverda **o'zgarmaydi**.

---

## 1. cPanel uchun GitHub token (bir marta)

Repo yopiq (private) bo'lgani uchun cPanel'ga uni o'qish ruxsati kerak.

1. GitHub → rasmingiz → **Settings** → eng pastda **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
2. Nomi: `cpanel-seeyousoon`, muddati: **1 yil** (yoki "No expiration")
3. **Repository access** → **Only select repositories** → `seeyousoon`
4. **Permissions** → **Contents** → **Read-only**
5. **Generate token** → tokenni nusxalab oling (`github_pat_...`). U faqat bir marta ko'rinadi!

## 2. cPanel'da repo ulash (bir marta)

cPanel → **Git™ Version Control** → **Create**:

| Maydon | Qiymat |
|---|---|
| Clone a Repository | ✅ yoqilgan |
| Clone URL | `https://ozodoov7:TOKEN@github.com/ozodoov7/seeyousoon.git` (TOKEN o'rniga 1-qadamdagi token) |
| Repository Path | `repositories/seeyousoon` |
| Repository Name | `seeyousoon` |

**Create** → bir necha soniyada kod yuklanadi.

> ⚠️ Repository Path'ni `invitation_project` qilmang — repo alohida turadi, fayllarni `.cpanel.yml` o'zi ko'chiradi.

## 3. Birinchi joylash (deploy)

Git Version Control → `seeyousoon` qatorida **Manage** → **Pull or Deploy** yorlig'i → **Deploy HEAD Commit**.

Keyin (faqat birinchi marta yoki `package.json` o'zgarganda):
**Setup Node.js App** → **▶ Установить NPM пакеты** → **Перезапустить**.

Agar hali MySQL bazani sozlamagan bo'lsangiz — `YANGILASH-v2.md` dagi 1–2-qadamlar (baza yaratish va `.env` ga yozish).

Tekshirish: `https://seeyousoon.uz/health` → `"db":"ok"`.

---

## Keyinchalik kodni yangilash

1. Kod GitHub'ga yuklanadi (men yuklayman yoki o'zingiz `git push`)
2. cPanel → Git Version Control → **Manage** → **Pull or Deploy**:
   - **Update from Remote** (GitHub'dan yangisini tortish)
   - **Deploy HEAD Commit** (ilovaga ko'chirish va qayta ishga tushirish)

Shu ikki tugma — tamom. Fayllarni qo'lda yuklash kerak emas.

Agar sayt eski holatda qolsa: Setup Node.js App → **Перезапустить**.

---

## O'z kompyuteringizdan GitHub'ga yuklash (ixtiyoriy)

```powershell
cd C:\loyihalar\invitation_project
git init
git add .
git commit -m "Yangilash"
git branch -M main
git remote add origin https://github.com/ozodoov7/seeyousoon.git
git push -u origin main
```

Keyingi safarlar: `git add .` → `git commit -m "..."` → `git push`.

`.gitignore` tufayli `.env`, `data`, `node_modules` yuklanmaydi — xavotir olmang.

## Muammolar

| Belgi | Yechim |
|---|---|
| Create'da "authentication failed" | Token xato yoki muddati o'tgan; repo `seeyousoon` tokenga qo'shilganini tekshiring |
| "Deploy HEAD Commit" tugmasi kulrang | Repo ildizida `.cpanel.yml` yo'q yoki serverdagi repo nusxasida o'zgartirilgan fayl bor — File Manager'da `repositories/seeyousoon` ga qo'l tekkizmang |
| Deploy bo'ldi, lekin sayt eski | Setup Node.js App → Перезапустить; brauzerda Ctrl+F5 |
| `Cannot find module 'mysql2'` | Setup Node.js App → Установить NPM пакеты |
