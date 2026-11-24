import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Token/user saqlash uchun yagona API.
 * Native'da expo-secure-store (shifrlangan), web'da localStorage (fallback).
 */
const webStore = {
  async getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // e'tiborsiz
    }
  },
  async deleteItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      // e'tiborsiz
    }
  },
};

const nativeStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};

const store = Platform.OS === 'web' ? webStore : nativeStore;

export const getItem = (key) =>
  store.getItem(key).catch(() => null);

export const setItem = (key, value) =>
  store.setItem(key, value).catch(() => {});

export const deleteItem = (key) =>
  store.deleteItem(key).catch(() => {});
