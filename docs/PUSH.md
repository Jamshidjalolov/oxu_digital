# Push bildirishnomalari

Web: hisobga kiring → qo‘ng‘iroq → sozlamalar → “Web Pushni yoqish” → brauzer ruxsatini bering. Keyin “Sinov push xabari yuborish” ni bosing. HTTPS yoki localhost kerak; oddiy LAN HTTP’da web push ishlamaydi. Sahifa yopiq bo‘lganda ham yetkazish brauzer va OS ruxsatlariga bog‘liq.

Android: Expo Go ichida tashqi push ishlamaydi. APK yoki development build kerak.

1. Expo/EAS loyihangiz ID sini `oxu-mobile/.env` ichida `EXPO_PUBLIC_EAS_PROJECT_ID` ga yozing.
2. Firebase’da `uz.oxu.digital` Android ilovasini ro‘yxatdan o‘tkazing. `google-services.json` ni `oxu-mobile/google-services.json` ga qo‘ying yoki `GOOGLE_SERVICES_JSON` orqali build faylining yo‘lini bering.
3. FCM V1 service account kalitini EAS Credentials’ga yuklang. Maxfiy kalitni chatga yoki Git’ga yubormang.
4. `oxu-mobile` papkasida `eas build --platform android --profile preview` bilan APK yarating. Telefonga o‘rnating, hisobga kiring, qo‘ng‘iroq → sozlamalar → “Mobil pushni yoqish”. Ruxsat bering va sinov xabarini yuboring.

API manzili APK uchun telefondan ochiladigan HTTPS manzil bo‘lsin (`EXPO_PUBLIC_API_URL`). Build yangi native konfiguratsiyani o‘z ichiga olishi kerak. Serverda worker va internet ulanishi ishlashi kerak. Sinov endpointi faqat joriy hisobga xabar yuboradi va 5 daqiqada 3 marta bilan cheklangan. Navbatga qabul qilish qurilmaga yetkazilganini anglatmaydi.

Rasmiy ko‘rsatmalar: https://docs.expo.dev/push-notifications/push-notifications-setup/ va https://docs.expo.dev/push-notifications/fcm-credentials/.
