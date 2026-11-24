import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { getItem, setItem, deleteItem } from '../storage';
import api from '../api';
import { disconnectPush } from '../notifications';

const AuthContext = createContext(null);

const TOKEN_KEY = 'oxu_token';
const USER_KEY = 'oxu_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutTask = useRef(null);

  // Ilovani ochganda saqlangan token/user ni tiklash
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getItem(TOKEN_KEY);
        const saved = await getItem(USER_KEY);
        if (token && saved) {
          const parsed = JSON.parse(saved);
          if (alive) setUser(parsed);
          try {
            const res = await api.get('/auth/me');
            const fresh = res.data && res.data.user ? res.data.user : res.data;
            if (alive) setUser(fresh);
            await setItem(USER_KEY, JSON.stringify(fresh));
          } catch (e) {
            if ([401, 403].includes(e.response?.status)) {
              await deleteItem(TOKEN_KEY);
              await deleteItem(USER_KEY);
              if (alive) setUser(null);
            }
          }
        }
      } catch (e) {
        // saqlangan ma'lumot buzilgan — tozalaymiz
        await deleteItem(TOKEN_KEY);
        await deleteItem(USER_KEY);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = async (token, userObj) => {
    await setItem(TOKEN_KEY, token);
    await setItem(USER_KEY, JSON.stringify(userObj));
    setUser(userObj);
  };

  const login = async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password });
    await persist(res.data.token, res.data.user);
    return res.data.user;
  };

  const logout = () => {
    if (logoutTask.current) return logoutTask.current;
    setLoading(true);
    logoutTask.current = (async () => {
      try {
        await disconnectPush();
        await deleteItem(TOKEN_KEY);
        await deleteItem(USER_KEY);
        setUser(null);
      } catch {
        const message = 'Push obunasini uzib bo‘lmadi. Hisob xavfsizligi uchun internetni tekshirib, chiqishni qayta bosing.';
        if (Platform.OS === 'web') window.alert(message);
        else Alert.alert('Chiqish bajarilmadi', message);
      } finally {
        setLoading(false);
        logoutTask.current = null;
      }
    })();
    return logoutTask.current;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile: async (payload) => { const res = await api.put('/auth/me', payload); await setItem(USER_KEY, JSON.stringify(res.data.user)); setUser(res.data.user); return res.data.user; } }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
