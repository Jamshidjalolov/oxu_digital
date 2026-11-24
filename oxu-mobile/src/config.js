import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API bazaviy manzili. Ustunlik tartibi:
 *   1. EXPO_PUBLIC_API_URL (expo start --clear bilan yuklanadi)
 *   2. app.json → extra.apiUrl
 *   3. Standart: Android emulator — 10.0.2.2, boshqa platforma — localhost
 */
const envUrl = process.env.EXPO_PUBLIC_API_URL;
const extraUrl = Constants.expoConfig && Constants.expoConfig.extra
  ? Constants.expoConfig.extra.apiUrl
  : null;

function getDefaultBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (Platform.OS !== 'web' && hostUri) {
    const host = hostUri.replace(/^https?:\/\//, '').split(':')[0];
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return `http://${host}:5000/api`;
  }
  // Android emulator localhost'ga to'g'ridan-to'g'ri kira olmaydi
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000/api';
  return 'http://localhost:5000/api';
}

export const API_BASE_URL = envUrl || extraUrl || getDefaultBaseUrl();

export const COLORS = {
  bg: '#f6f8fb',
  card: '#ffffff',
  primary: '#315eeb',
  primaryDark: '#2348c1',
  primaryLight: '#6b8df5',
  accent: '#8464cf',
  text: '#19263c',
  muted: '#77849a',
  border: '#e8edf4',
  green: '#16a34a',
  greenBg: '#dcfce7',
  red: '#dc2626',
  redBg: '#fee2e2',
  amber: '#d97706',
  amberBg: '#fef3c7',
  gray: '#94a3b8',
  grayBg: '#eef2f7',
  white: '#ffffff',
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const GRADIENTS = {
  primary: ['#315eeb', '#2348c1'],
  hero: ['#101f46', '#203d7d', '#315eeb'],
  success: ['#16a34a', '#15803d'],
  violet: ['#7c3aed', '#5b21b6'],
};

export const SHADOWS = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  soft: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  float: {
    shadowColor: '#1e40af',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 10,
  },
};

export const WEEKDAY_NAMES = [
  'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba',
  'Payshanba', 'Juma', 'Shanba',
];

const MONTH_NAMES = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Berilgan (yoki joriy) sananing dushanbasini YYYY-MM-DD qilib qaytaradi */
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Yakshanba
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

/** YYYY-MM-DD ga kun qo'shadi, YYYY-MM-DD qaytaradi */
export function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** "2026-11-09" → "9 noyabr, dushanba" */
export function formatDateLong(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${WEEKDAY_NAMES[d.getDay()].toLowerCase()}`;
}

/** "2026-11-09" → "09.11.2026" */
export function formatDateShort(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
