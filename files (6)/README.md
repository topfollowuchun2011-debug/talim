# EduPortal — ta'lim boshqaruv tizimi

BSB/CHSB topshiriqlari, baholar, reyting, onlayn testlar va ish topshirish tizimi.
Kod haqiqiy loyihalardagidek bo'laklarga ajratilgan: har bir fayl bitta vazifani bajaradi.

## Ishga tushirish

`index.html` ni brauzerda oching — **boshqa hech narsa kerak emas**. Server ham,
`npm install` ham, build ham shart emas. Ikki marta bossangiz ochiladi.

Hostingga qo'ysangiz ham xuddi shunday ishlaydi: papkani GitHub Pages, Netlify
yoki oddiy cPanel hostingga yuklang, tamom.

Birinchi ochilishda namuna ma'lumotlar (6 o'quvchi, 3 topshiriq, 1 test, 1 e'lon)
avtomatik yoziladi, shunda tizim bo'sh emas. Ularni **Sozlamalar → Mustaqil rejim →
Barcha ma'lumotni tozalash** orqali o'chirasiz.

## Ikki rejim

Sayt qayerda ochilganini o'zi aniqlaydi:

| | Qayerda | Ma'lumot qayerda | Kim ko'radi |
|---|---|---|---|
| **Server rejimi** | Claude artifact sifatida | Claude serveridagi bazada | tashkilotdagi hamma, real vaqtda |
| **Mustaqil rejim** | O'z kompyuteringiz yoki hosting | brauzer `localStorage` da | faqat shu brauzer |

Qolgan kod farqni sezmaydi — `js/db.js` bir xil API beradi, `js/local-db.js` esa
o'sha API ning brauzer xotirasidagi nusxasi.

Mustaqil rejimda rol **Sozlamalar** bo'limidan almashtiriladi (o'quvchi ↔ admin),
chunki bu nusxa faqat sizniki. Server rejimida rol Claude'ning **Share** menyusidan
belgilanadi: "Can edit" bergan odam o'qituvchi/admin bo'ladi.

## Loyiha tuzilmasi

```
index.html            — faqat HTML tuzilma, ichida na uslub na skript
css/
  base.css            — ranglar (CSS o'zgaruvchilar), shriftlar, reset, qorong'i rejim
  layout.css          — sahifa karkasi: yon menyu, yuqori panel, kontent maydoni
  components.css      — tugma, forma, karta, jadval, tag, modal, toast, test oynasi
  responsive.css      — telefon/planshet moslashuvi va chop etish uslublari
js/
  icons.js            — barcha SVG ikonkalar
  config.js           — menyu tuzilmasi (NAV)
  utils.js            — kichik yordamchilar: $, esc, sana, toast, confirm
  store.js            — umumiy holat (S) va hisob-kitoblar (reyting, o'rtacha ball)
  local-db.js         — zaxira baza + namuna ma'lumotlar
  shell.js            — yon menyu, mavzu almashtirish, sahifalar orasida o'tish
  db.js               — qaysi bazaga ulanishni tanlaydi, obunalar va yozish amallari
  files.js            — CSV eksport, rasm o'qish
  views.js            — foydalanuvchi bo'limlarini chizish
  admin.js            — boshqaruv panelini chizish
  modals.js           — forma oynalari va dialoglar
  exam.js             — onlayn test: taymer, savollar, natija
  main.js             — hodisalarni ulaydi va ilovani ishga tushiradi
README.md
```

Skriptlar `index.html` da **shu tartibda** ulangan — tartibni o'zgartirmang,
chunki keyingi fayl oldingisining funksiyalaridan foydalanadi.

## Kod qanday ishlaydi

1. `main.js` → `boot()` ishga tushadi.
2. `db.js` → `connect()` Claude bor-yo'qligini tekshiradi va bazani tanlaydi.
3. `db.js` → `subscribe()` har bir kolleksiyaga obuna bo'ladi.
4. Ma'lumot kelganda `hooks.renderAll()` chaqiriladi.
5. `main.js` dagi `renderAll()` barcha chizish funksiyalarini bir marta yurgizadi.

`hooks` — `store.js` dagi oddiy obyekt. U aylanma bog'liqlikning oldini oladi:
`db.js` `main.js` ni bilishi shart emas, shunchaki `hooks.renderAll()` ni chaqiradi.

## Baza tuzilmasi

| Yo'l | Nima saqlanadi | Kim yozadi (server rejimi) |
|---|---|---|
| `students/<id>` | ism, sinf | o'quvchi — faqat o'zinikini |
| `grades/<id>` | BSB, CHSB, fan baholari | faqat admin |
| `tasks/<id>` | BSB/CHSB topshiriqlari | faqat admin |
| `exams/<id>` | test savollari | faqat admin |
| `announcements/<id>` | e'lonlar | faqat admin |
| `submissions/<id>` | yuborilgan ishlar | o'quvchi yozadi, admin baholaydi |
| `examResults/<id>` | test natijalari | o'quvchi — faqat o'zinikini |
| `meta/settings` | muassasa sozlamalari | faqat admin |
| `data/users/<id>/prefs` | shaxsiy sozlamalar | faqat egasi |

Server rejimida bu ruxsatlar server tomonda tekshiriladi — o'quvchi o'z bahosini
o'zgartira olmaydi.

## O'z backend'ingizga ulash

Faqat `js/db.js` va `js/local-db.js` ni almashtiring (masalan Firebase, Supabase
yoki o'z PHP/Node API'ingiz). Qolgan 11 ta fayl bazani umuman bilmaydi.

Kerakli funksiyalar: `connect`, `subscribe`, `saveTask`, `saveExam`, `saveGrade`,
`saveAnnouncement`, `saveSettings`, `saveMyProfile`, `writeMySubs`,
`reviewSubmission`, `removeDoc`, `savePrefs`.

`local-db.js` dagi hujjat API'si Firestore bilan deyarli bir xil
(`doc`, `collection`, `where`, `orderBy`, `limit`, `onSnapshot`), shuning uchun
Firebase ga o'tish eng oson yo'l.
