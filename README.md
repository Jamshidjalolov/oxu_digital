# OXU Digital

Osiyo Xalqaro Universiteti uchun dars jadvali, davomat va bildirishnomalar tizimi.

| Qism | Texnologiya | Manzil |
| --- | --- | --- |
| Web | React + Vite | http://localhost:5173 |
| API | Express + MongoDB | http://localhost:5000/api/health |
| Mobil | React Native + Expo | http://localhost:8081 (web ko‘rinish) |
| Telegram | Telegraf | `.env` dagi bot |

## Tez boshlash

Node.js 20.19 yoki yangirog‘i kerak. Buyruqlarni shu asosiy papkada bajaring:

```sh
npm run setup
npm run demo
```

Paketlar o‘rnatilgan bo‘lsa, faqat `npm run demo` yetarli. Demo alohida MongoDB jarayonini ochadi, bo‘sh bazaga namunaviy ma’lumotlarni kiritadi, so‘ng API, web, mobil web va token sozlangan Telegram botni ishga tushiradi. MongoDB binari birinchi ishga tushishda yuklanishi mumkin. Ma’lumotlar `.local-data/mongo` ichida saqlanadi va qayta ishga tushirishda tiklanadi. Mavjud asosiy bazaga tegilmaydi. To‘xtatish: `Ctrl+C`.

| Demo rol | Telefon | Parol |
| --- | --- | --- |
| Administrator | 900000000 | 123456 |
| O‘qituvchi | 901000001 | 123456 |
| Talaba | 931000001 | 123456 |

Bu hisoblar yangi demo bazasida yaratiladi. Demo darslari 2026-yil 9–14-noyabr haftasiga kiritilgan; boshqa haftada jadval navigatsiyasidan shu haftani tanlang. Telegram bot sozlangan bo‘lsa, u demo API bilan ishlaydi. Bildirishnomalar yoqilgan: botga kirgan va hisobini bog‘lagan foydalanuvchilarga Telegram xabarlari yuboriladi. Web va native push foydalanuvchi ruxsati va ro‘yxatdan o‘tgan qurilma obunasini talab qiladi. Lokal VAPID kalitlari `.local-data/notification-secrets.json` da saqlanadi; faylni Git’ga yuklamang.

## O‘z bazangiz bilan ishlash

`oxu-server/.env.example` asosida `oxu-server/.env` yarating va `MONGO_URI`, `JWT_SECRET` ni belgilang. MongoDB ishlayotgan bo‘lishi kerak.

```sh
npm run dev
```

API va web ochiladi. Mobil web va botni ham qo‘shish uchun:

```sh
npm run dev:all
```

Bot uchun `oxu-bot/.env` da `BOT_TOKEN` kerak. `BOT_LINK_SECRET` backend va botda bir xil bo‘lsin. Token bo‘lmasa, ishga tushiruvchi botni o‘tkazib yuboradi va qolgan xizmatlar ishlaydi. Tokenlar konsolga chiqarilmaydi.

Web `/api` so‘rovlarini Vite orqali 5000-portga uzatadi. Alohida joylashtirishda `VITE_API_URL` ni belgilang. Production uchun `npm run build` natijasi `oxu-web/dist` ichida; serverda `/api` reverse proxy yoki alohida API URL kerak.

## Telefon va native mobil ilova

8081-portdagi versiya — brauzerda tekshirish uchun. Telefon yoki emulatorda alohida `oxu-mobile` papkasidan `npm start` ishlating. Haqiqiy telefonda `.env.example` asosida `EXPO_PUBLIC_API_URL=http://KOMPYUTER_IP:5000/api` qo‘ying; Android emulator uchun standart manzil `10.0.2.2`. Bitta 8081-portni ikki Expo jarayoni bilan band qilmang. Native push bildirishnomalari development build/APK, qurilma ruxsatlari va Expo loyiha sozlamalarini talab qiladi; web preview ularni tekshirmaydi.

## Tekshirish

```sh
npm test
npm run build
npm run smoke
```

`npm test` to‘rtta qismdagi testlarni ketma-ket bajaradi. Backend testlari alohida vaqtinchalik MongoDB bazasidan foydalanadi. `npm run smoke` ishlab turgan demo servislarining uchala rol bilan kirishini, jadval, statistika va web proxy ulanishini tekshiradi.

API hujjati: [docs/API.md](docs/API.md).

## Realtime va xavfsizlik

Web va mobil ilova `/api/realtime` WebSocket kanaliga token bilan ulanadi. Token URL orqali yuborilmaydi. Kanal faqat tegishli foydalanuvchiga ma’lumotni qayta yuklash signalini beradi; shaxsiy ma’lumotlar odatiy avtorizatsiyalangan API orqali olinadi. Uzilishdan so‘ng qayta ulanish ma’lumotni yangilaydi. Jadval va bildirishnomalar real vaqtda yangilanadi; davomat statistikasi web’da ham yangilanadi.

Production’da `ALLOWED_ORIGINS=https://SIZNING_DOMEN` ni belgilang, HTTPS/WSS va reverse proxy’da `/api/realtime` uchun WebSocket Upgrade uzatishni sozlang. Login uchun muvaffaqiyatsiz urinishlar cheklovi, API tezlik cheklovi, Helmet, HS256 token tekshiruvi, socket hajmi va ulanish soni cheklovi qo‘shilgan. Hisob holati socketda har 30 soniyada qayta tekshiriladi. Amaldagi limitlar va realtime tarqatish bitta server jarayoni doirasida; bir nechta server uchun umumiy rate-limit saqlagichi va pub/sub kerak. Bu choralar to‘liq xavfsizlik auditi yoki 100% kafolat o‘rnini bosmaydi.

Brauzer tekshiruvi (ixtiyoriy, o‘rnatilgan Chrome bilan):

```sh
npm install --prefix .local-data/qa --no-save playwright
node scripts/browser-qa.cjs
```

Bu tekshiruv web va Expo web sahifalarini uchala rol bilan ochadi, telefon/planshet o‘lchamlarini va gorizontal siljishni tekshiradi. Skrinshotlar `artifacts/` papkasida saqlanadi. Haqiqiy Android/iOS qurilmada native push tekshiruvi alohida bajariladi.
