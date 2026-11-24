# OXU Digital — Mobil ilova

Osiyo Xalqaro Universiteti uchun davomat tizimi mobil ilovasi.
Expo (SDK 58) + React Navigation + axios + expo-secure-store. Backend: `oxu-server`.

## Ishga tushirish

```bash
npm install
npx expo start
```

So'ngra:
- **Android emulator**: `a` tugmasi. E'tibor: emulator `localhost` ga kira olmaydi, shuning uchun
  koddagi standart manzil avtomatik `http://10.0.2.2:5000/api` ga o'zgartiriladi (faqat Android).
- **Haqiqiy telefon**: Expo Go ilovasi bilan QR-kodni skanerlang. Shu holda kompyuteringizning
  lokal IP manzilini ishlatish kerak, masalan:
  ```bash
  EXPO_PUBLIC_API_URL=http://192.168.1.10:5000/api npx expo start
  ```
  yoki `.env` fayl yarating (`.env.example` ga qarang).
- **Web**: `w` tugmasi yoki `npx expo start --web`.

Skriptlar: `npm start`, `npm run android`, `npm run ios`, `npm run web`, `npm test`.

Expo Go oddiy ekranlarni ko‘rish uchun; ushbu ilovada native push APK/development build orqali tekshiriladi.

## Demo loginlar

| Rol | Telefon | Parol |
|---|---|---|
| O'qituvchi | `901000001` | `123456` |
| Talaba | `931000001` | `123456` |
| Admin | `900000000` | `123456` |

Jadval ko'rsatilgan hafta: **2026-11-09** dan boshlanadi (avtomatik joriy hafta hisoblanadi,
‹ › tugmalari bilan boshqa haftalarga o'tish mumkin).

## API manzilini sozlash

Ustunlik tartibi:
1. `EXPO_PUBLIC_API_URL` muhit o'zgaruvchisi (yoki `.env`)
2. `app.json` → `extra.apiUrl`
3. Standart: Android → `http://10.0.2.2:5000/api`, boshqa → `http://localhost:5000/api`

## Tuzilma

```
src/
  config.js            — API manzili, hafta/sana yordamchilari, ranglar
  api.js               — axios instansiyasi (Bearer token avtomatik birikadi)
  context/AuthContext.js — login/logout, SecureStore'da token+user
  hooks/useWeekSchedule.js — haftalik jadval yuklash
  components/          — Header, WeekNavigator, DaySection, LessonCard, StatusBadge, EmptyState
  screens/
    auth/              — LoginScreen; hisobni administrator yaratadi
    AdminScreen.js     — foydalanuvchi yaratish, dars biriktirish, guruh va fanlar
    teacher/           — Bosh sahifa, Davomat olish, Attendance (belgilash), Profile, Placeholder
    student/           — Bosh sahifa (jadval), Davomat (statistika), Profile
  navigation/          — RootNavigator, TeacherTabs, StudentTabs
```

## Bildirishnomalar va Android APK

Qo‘ng‘iroq tugmasi oxirgi 50 ta xabar, o‘qilmagan soni, o‘qilgan qilish va kanal sozlamalarini ochadi. Tarix ilova faol paytda 10 soniyada yangilanadi. Pushni bosish tarixni ochadi va tegishli xabarni o‘qilgan qiladi. Telegram uchun botdagi shaxsiy login kerak. Oddiy SMS yuborilmaydi.

Native push uchun haqiqiy telefon, Expo loyiha IDsi va Firebase Cloud Messaging kerak. Web preview va emulator native pushni tasdiqlamaydi. Chiqishda push obunasi serverdan uziladi; internet bo‘lmasa xavfsizlik uchun chiqish tugallanmaydi va qayta urinish xabari ko‘rsatiladi.

APK profili `eas.json` da tayyor (`preview`, ichki tarqatish, APK). Android application ID: `uz.oxu.digital`. Haqiqiy Expo/Firebase akkaunt ma’lumotlari loyihaga uydirib qo‘yilmagan.

1. `eas login` bilan o‘z Expo hisobingizga kiring, `eas init` orqali haqiqiy loyihani ulang. Project ID `app.json → expo.extra.eas.projectId` yoki `EXPO_PUBLIC_EAS_PROJECT_ID` orqali beriladi.
2. Firebase loyihasida `uz.oxu.digital` Android ilovasini ro‘yxatdan o‘tkazing. Shu ilovaga tegishli `google-services.json` faylini mobil loyiha ichiga qo‘ying va `app.json → expo.android.googleServicesFile` ni `./google-services.json` ga o‘rnating.
3. `eas credentials --platform android` orqali Firebase FCM V1 service-account kalitini Expo loyihasiga sozlang. Service-account private kalitini ilova assetsiga yoki repoga qo‘shmang. Serverda zarur bo‘lsa `EXPO_ACCESS_TOKEN` ni sozlang.
4. `EXPO_PUBLIC_API_URL` ni telefon kira oladigan haqiqiy HTTPS backend manziliga EAS build muhitida belgilang. Production APK ichida `localhost` yoki emulatorning `10.0.2.2` manzilini ishlatmang. Lokal HTTP sinovi uchun alohida development build kerak bo‘lishi mumkin.
5. `eas build --platform android --profile preview` bilan APK yig‘ing. Store uchun `--profile production` AAB chiqaradi. Build tashqi Expo xizmatida bajariladi.
6. APKni o‘rnating, kiring, qo‘ng‘iroq → sozlamalar → `Mobil pushni yoqish` orqali ruxsat bering. Sinov hisobiga dars biriktirib, foreground/background/yopiq ilova holatlarida va notification bosilganda tekshiring. Chiqish va boshqa hisobga kirishda eski hisob xabarlari kelmasligini tekshiring.

`npm test` native APIlar o‘rniga mocklar bilan ruxsat, obuna, bekor qilish va chiqish poygalarini tekshiradi. `npx expo export --platform android --platform web` faqat JavaScript/assets bundle yaratadi: bu APK build ham, haqiqiy FCM yetkazish sinovi ham emas.
