import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import { getItem, setItem, deleteItem } from './storage';
import api from './api';

const PUSH_KEY = 'oxu_push_token';
let pending = null;
let generation = 0;

const isExpoGo = () => isRunningInExpoGo() || Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
export const nativeNotifications = () => Platform.OS === 'web' || isExpoGo() ? null : require('expo-notifications');

export function pushUnavailable() {
  if (Platform.OS === 'web') return 'Bu mobil ilovaning web ko‘rinishi. Brauzer pushini asosiy web ilovada yoqing.';
  if (!Device.isDevice) return 'Push uchun haqiqiy telefon kerak.';
  if (isExpoGo()) return 'Push uchun Expo Go emas, OXU Digital development build yoki APK ilovasini o‘rnating.';
  if (!(Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID)) return 'Expo loyiha IDsi va Android FCM sozlamalari hali kiritilmagan.';
  return '';
}

export async function registerPush() {
  if (pending) return pending;
  const reason = pushUnavailable();
  if (reason) throw new Error(reason);
  const version = generation;
  pending = (async () => {
    const Notifications = nativeNotifications();
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('oxu-updates', { name: 'OXU Digital', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250] });
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Bildirishnoma ruxsati berilmadi. Telefon sozlamalaridan ruxsat bering.');
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    let timer;
    const { data: token } = await Promise.race([
      Notifications.getExpoPushTokenAsync({ projectId }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Push tokenini olish vaqti tugadi. Qayta urinib ko‘ring.')), 15000); }),
    ]).finally(() => clearTimeout(timer));
    if (version !== generation) return;
    await setItem(PUSH_KEY, token);
    try {
      await api.post('/notifications/subscriptions', { type: 'expo', token });
      if (version !== generation) return;
      await api.put('/notifications/preferences', { mobile: true });
      return token;
    } catch (error) {
      try {
        await api.delete('/notifications/subscriptions', { data: { type: 'expo', token }, timeout: 5000 });
        await deleteItem(PUSH_KEY);
      } catch {}
      throw error;
    }
  })().finally(() => { pending = null; });
  return pending;
}

export async function disconnectPush() {
  generation += 1;
  if (pending) await pending.catch(() => {});
  const token = await getItem(PUSH_KEY);
  if (token) await api.delete('/notifications/subscriptions', { data: { type: 'expo', token }, timeout: 5000 });
  await deleteItem(PUSH_KEY);
  const Notifications = nativeNotifications();
  if (Notifications) await Notifications.dismissAllNotificationsAsync().catch(() => {});
}

export const hasPushToken = async () => Boolean(await getItem(PUSH_KEY));
