# OXU Digital — API shartnomasi

Barcha ilovalar (web, mobile, bot) bitta backendga ulanadi:
- **Base URL (dev):** `http://localhost:5000/api`
- **Auth:** `Authorization: Bearer <token>` (JWT, faqat login'dan qaytadi). Ochiq ro‘yxatdan o‘tish yo‘q; hisoblarni faqat admin web, mobil ilova yoki bot orqali yaratadi.
- Barcha javoblar JSON. Xatolik: `{ "message": "..." }` + HTTP status.

## Auth (`/auth`)
| Metod | Yo'l | Tavsif |
|---|---|---|
| POST | `/auth/login` | `{phone, password}` → `{token, user}` |
| GET | `/auth/me` | Joriy foydalanuvchi |
| PUT | `/auth/telegram` | `{telegramId: "123456789"\|null}` — JWT va `X-Oxu-Bot-Secret` orqali shaxsiy Telegramni bog‘lash/uzish |

`user` obyekti: `{id, fullName, phone, role: "admin"\|"teacher"\|"student", group: {id, name}|null}`

## Ochiq kataloglar (token shart emas)
- GET `/groups` → `[{id, name}]`
- GET `/subjects` → `[{id, name}]`

## Admin (`/admin`, faqat role=admin)
- GET `/admin/users?role=` → users ro'yxati (password'siz, group populate)
- POST `/admin/users` `{fullName, phone, password, role: "admin"|"teacher"|"student", groupId?, approved?}` → yangi hisob (password’siz); `approved` odatda `true`, talaba uchun mavjud `groupId` shart. Faqat admin yaratadi.
- PUT `/admin/users/:id` (xuddi shunday + `approved`)
- DELETE `/admin/users/:id`
- GET/POST/DELETE `/admin/groups` — POST `{name}`; GET qaytaradi `[{id, name, studentCount}]`
- GET/POST/DELETE `/admin/subjects` — POST `{name}`
- GET `/admin/lessons?weekStart=YYYY-MM-DD&teacherId=` → haftalik darslar (populate: teacher.fullName, subject.name, groups.name)
- GET `/admin/lesson-slots?date=YYYY-MM-DD&teacherId=&groupIds=id1,id2` → `{date, slots: [{pairNumber, startTime, endTime}]}` — faqat bo'sh para slotlari; sana bugun yoki o'tgan kun bo'lsa `400` (`Darsni kamida bir kun oldin biriktirish mumkin`)
- POST `/admin/lessons` `{teacherId, subjectId, groupIds[], date, startTime, endTime, pairNumber, room, building, type}` — vaqt standart para vaqtiga mos bo'lishi shart; `date` kamida ertangi kun bo'lishi kerak, aks holda `400`
- DELETE `/admin/lessons/:id`
- GET `/admin/workload?weekStart=` → `{dates: [6 ta sana], grid: [{teacherId, fullName, cells: {"YYYY-MM-DD_<pairNumber>": true}}]}` — bandlik gridi

Standart para vaqtlari: 1 — 09:00–10:20, 2 — 10:30–11:50, 3 — 12:00–13:20, 4 — 13:20–14:40, 5 — 14:50–16:10, 6 — 16:20–17:40, 7 — 17:50–19:10, 8 — 19:20–20:40, 9 — 20:50–22:10.

## O'qituvchi (`/teacher`, role=teacher yoki admin)
- GET `/teacher/schedule?weekStart=YYYY-MM-DD` →
  `{weekStart, dates: [6], byDay: {"YYYY-MM-DD": [Lesson]}, total}` — dushanbadan shanbagacha
- GET `/teacher/lessons?from=&to=` → barcha darslar
- GET `/teacher/lessons/:id/attendance` →
  `{lesson: {id, date, startTime, endTime, room, building, type, pairNumber, subject: {name}, groups: [{name}]}, attendanceLocked, attendanceAllowed, attendanceTakenAt, students: [{id, fullName, status: "present"\|"absent"\|null}]}` — `attendanceAllowed: false` faqat o'tgan kunlardagi darslar uchun
- PUT `/teacher/lessons/:id/attendance` — `{records: [{studentId, status: "present"\|"absent"}]}` (barcha talabalar belgilanishi shart; har bir dars uchun faqat bir marta, qayta saqlash `409`; o'tgan kun uchun `400` — `O‘tgan kun uchun davomat olinmaydi`)
- GET `/teacher/stats` → `{total, present, absent}`

## Student (`/student` dan keyingi, role=student, lekin `/groups` va `/subjects` ochiq)
- GET `/student/schedule?weekStart=` → xuddi teacher kabi + har darsda `myStatus: "present"\|"absent"\|null`
- GET `/student/attendance` → `{total, present, absent, percentage, records: [{id, date, subject, status}]}`

## Lesson obyekti
`{_id, date: "YYYY-MM-DD", startTime: "HH:MM", endTime: "HH:MM", pairNumber, room, building, type: "Ma'ruza"\|"Amaliyot"\|"Laboratoriya", attendanceTakenAt, attendanceTakenBy, subject: {_id, name}, groups: [{_id, name}], teacher?: {_id, fullName}}`

## Demo loginlar (seed)
- Admin: `900000000` / `123456`
- O'qituvchi: `901000001` (RAJABOV AZIZBEK) / `123456`
- Talaba: `931000001` / `123456`

Jadval haftasi: **2026-11-09** dan boshlanadi (weekStart parametriga `2026-11-09` yuboring).

## Bildirishnomalar (`/notifications`, JWT shart)

- GET `/notifications/config` → `{webPush: {configured, publicKey}, expoPush: {configured}, telegram: {configured, linked}, preferences: {web, mobile, telegram}}`. `expoPush.configured` serverning Expo gateway bilan ishlashini bildiradi, qurilmadagi FCM sozlamalarini tasdiqlamaydi.
- GET `/notifications?before=<ObjectId>` → `{items, unreadCount, nextCursor}`. Faqat joriy hisob, eng yangi 50 ta; keyingi sahifa uchun `nextCursor` ishlatiladi.
- PUT `/notifications/:id/read` → o‘z bildirishnomasini o‘qilgan qilish; qayta chaqirish xavfsiz.
- PUT `/notifications/read-all` → o‘zining barcha xabarlarini o‘qilgan qilish.
- PUT `/notifications/preferences` → `{web?: boolean, mobile?: boolean, telegram?: boolean}`; kamida bitta kanal.
- POST `/notifications/subscriptions` → `{type: "web", subscription: {endpoint, keys: {p256dh, auth}}}` yoki `{type: "expo", token}`.
- DELETE `/notifications/subscriptions` → `{type: "web", endpoint}` yoki `{type: "expo", token}`; faqat joriy hisobning obunasi.

Tarix yozuvi: `{_id, kind, title, body, url, data, readAt, createdAt, updatedAt}`. Bir hisobga ko‘pi bilan 20 ta yangi qurilma obunasi. Tashqi/internal ixtiyoriy URLlarga push yuborilmaydi.

### Hodisalar va oluvchilar

- Dars yaratish/bekor qilish: biriktirilgan o‘qituvchi, guruh talabalari, faol adminlar.
- Davomat: faqat belgisi o‘zgargan talabaga o‘z holati; o‘qituvchi va adminlarga umumiy natija. O‘zgarmagan ro‘yxatni qayta saqlash yangi xabar yaratmaydi. Belgini olib tashlash ham xabar yaratadi.
- Hisob yaratish/tahrirlash: faol hisob egasi va adminlar; parol qiymatlari yuborilmaydi. Hisobni o‘chirish: adminlar.
- Guruh va fan yaratish/o‘chirish: adminlar.
- O‘qilgan qilish, login va sozlama almashtirish yangi bildirishnoma yaratmaydi. Oddiy telefon SMS yuborilmaydi.

### Server va bot sozlamalari

`oxu-server/.env` da `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` kerak. Kalitlarni bir marta `web-push.generateVAPIDKeys()` bilan yarating va keyingi ishga tushirishlarda saqlang; private kalit frontendga berilmaydi. Production uchun haqiqiy aloqa manzili (`mailto:`) va HTTPS sayt ishlating.

Telegram uchun serverda `TELEGRAM_BOT_TOKEN`, botda `BOT_TOKEN` bir xil botning tokeni bo‘lishi kerak. Har ikkala `.env` da kuchli, bir xil `BOT_LINK_SECRET` belgilang. Secret faqat serverlar orasida ishlatiladi, web/mobile ichiga qo‘ymang. Botni `npm start` bilan ishga tushiring va shaxsiy chatda qayta login qiling: eski tasdiqlanmagan Telegram IDlar xabar olmaydi. Botdagi `Bildirishnomalar` menyusi oxirgi 10 ta xabar, o‘qilgan holati va kanalni yoqish/o‘chirishni boshqaradi. Botdan chiqish bog‘lanishni uzadi; tarmoq xatosida uzilmagani haqida ogohlantiradi.

Navbat MongoDBda saqlanadi; worker 5 soniyada tekshiradi. Vaqtinchalik xatolar qayta uriniladi (6 yuborish urinishigacha), Expo receipt alohida tekshiriladi (30 tekshiruvgacha). Web 404/410 va Expo `DeviceNotRegistered` obunasi tozalanadi. Yetkazish paytida tasdiq, kanal va obuna egasi yana tekshiriladi. Gateway qabul qilishi foydalanuvchi xabarni ko‘rganini anglatmaydi.

Biznes o‘zgarishi va bildirishnoma yozuvi yagona MongoDB tranzaksiyasiga birlashtirilmagan; atomar yoki aynan bir marta yetkazish kafolati yo‘q. Worker xabarning qabul qilinganini yozishdan oldin to‘xtasa takror yetkazish mumkin.

### Tekshirish

Har bir ilova papkasida `npm test`: serverda izolyatsiyalangan MongoDB va mocked providerlar, botda mocked API, webda service worker, mobileda native push hayot sikli tekshiriladi. Testlar haqiqiy Telegram/Expo xabarlarini yubormaydi. Web UI uchun `npm run dev`; mobile uchun `npm run web`. Android APK/FCM bo‘yicha `oxu-mobile/README.md` ga qarang.
