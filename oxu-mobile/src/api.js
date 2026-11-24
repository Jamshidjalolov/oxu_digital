import axios from 'axios';
import { getItem } from './storage';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Har bir so'rovga Bearer token biriktirish
api.interceptors.request.use(async (config) => {
  try {
    const token = await getItem('oxu_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // token o'qishda xatolik — so'rovni token'siz davom ettiramiz
  }
  return config;
});

export default api;
