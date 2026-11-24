# OXU Digital — Web Frontend

Osiyo Xalqaro Universiteti (AIU) uchun davomat (davomat) tizimining veb-ilovasi.

## Texnologiyalar

- Vite + React 18 (JavaScript)
- react-router-dom v6
- axios
- lucide-react (ikonkalar)
- Plain CSS (Tailwind ishlatilmagan)

## O'rnatish va ishga tushirish

```bash
npm install
npm run dev      # http://localhost:5173
```

Backend `http://localhost:5000/api` manzilida ishlashi kerak.
Boshqa manzil uchun `.env` fayl yarating:

```
VITE_API_URL=http://localhost:5000/api
```

Namuna uchun `.env.example` fayliga qarang.

## Build

```bash
npm run build    # dist/ papkasiga production build
npm run preview  # build'ni lokal ko'rish
```

## Demo loginlar

| Rol | Telefon | Parol |
|---|---|---|
| Administrator | 900000000 | 123456 |
| O'qituvchi | 901000001 | 123456 |
| Talaba | 931000001 | 123456 |

## Sahifalar

- `/login` — kirish; ochiq ro‘yxatdan o‘tish yo‘q
- `/admin/users` — hisoblarni faqat admin yaratadi (talaba, o‘qituvchi yoki admin)
- `/admin` — admin panel (dashboard, foydalanuvchilar, guruhlar/fanlar, dars jadvali/bandlik gridi, hisobot)
- `/teacher` — o'qituvchi paneli (haftalik jadval, davomat olish, statistika)
- `/student` — talaba paneli (haftalik jadval, shaxsiy davomat)

## Bildirishnomalar

Barcha rollarda pastdagi qo‘ng‘iroq tugmasi oxirgi 50 ta xabar, o‘qilmagan soni, o‘qilgan qilish va kanal sozlamalarini ochadi. Tarix 10 soniyada va oynaga qaytilganda yangilanadi. Push ishlamasa ham tarix mavjud.

Web Push uchun HTTPS yoki localhost, pushni qo‘llaydigan brauzer va backenddagi VAPID kalitlari kerak (`../docs/API.md`). `Sozlamalar → Web Pushni yoqish` tugmasini bosib brauzer ruxsatini bering. Ruxsat bloklangan bo‘lsa sayt sozlamalaridan o‘zgartiring. `/push-sw.js` bildirishnomani ko‘rsatadi va faqat shu sayt ichidagi manzilni ochadi; shaxsiy API javoblarini keshlamaydi. Hisobdan chiqishda obuna uziladi.

Mobil/Telegram belgilari kanal afzalligini boshqaradi; qurilma obunasi mobil ilovada, Telegram bog‘lanishi botdagi login orqali yaratiladi. Oddiy telefon SMS yuborilmaydi.

`npm test` service worker payload va xavfsiz navigatsiyani tekshiradi; haqiqiy operatsion tizim bildirishnomasini ko‘rsatishni alohida ruxsat berilgan brauzerda sinang.
