import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOWS } from '../config';
import api from '../api';
import { disconnectPush, hasPushToken, nativeNotifications, pushUnavailable, registerPush } from '../notifications';
import { subscribeRealtime } from '../realtime';

function Inbox() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [settings, setSettings] = useState(false);
  const lifetime = useRef(null);
  const refreshing = useRef(false);
  const acting = useRef(false);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || refreshing.current || acting.current) return;
    refreshing.current = true;
    const version = revision.current;
    try {
      const [inbox, channels, hasToken] = await Promise.all([
        api.get('/notifications', { signal: controller.signal, timeout: 8000 }),
        api.get('/notifications/config', { signal: controller.signal, timeout: 8000 }),
        hasPushToken(),
      ]);
      if (controller.signal.aborted || revision.current !== version) return;
      setItems(inbox.data.items);
      setCount(inbox.data.unreadCount);
      setConfig(channels.data);
      setSubscribed(hasToken);
      setError('');
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.data?.message || 'Bildirishnomalarni yuklab bo‘lmadi.');
    } finally {
      if (lifetime.current === controller) refreshing.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    refresh();
    const unsubscribe = subscribeRealtime(refresh);
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 10000);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    const Notifications = nativeNotifications();
    let received, tapped, rotated;
    if (Notifications) {
      Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
      received = Notifications.addNotificationReceivedListener(refresh);
      rotated = Notifications.addPushTokenListener(async () => {
        try {
          if (await hasPushToken() && !controller.signal.aborted) await registerPush();
        } catch {
          if (!controller.signal.aborted) setError('Push tokenini yangilab bo‘lmadi. Sozlamalardan qayta yoqing.');
        }
      });
      const onTap = async (response) => {
        if (controller.signal.aborted) return;
        setOpen(true);
        const id = response.notification.request.content.data?.notificationId;
        if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) {
          try { await api.put(`/notifications/${id}/read`, {}, { signal: controller.signal }); } catch { /* Inbox remains available if marking fails. */ }
        }
        refresh();
      };
      tapped = Notifications.addNotificationResponseReceivedListener(onTap);
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response && !controller.signal.aborted) {
          onTap(response);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      }).catch(() => {});
    }
    return () => {
      controller.abort();
      refreshing.current = false;
      clearInterval(timer);
      unsubscribe();
      appState.remove();
      received?.remove();
      tapped?.remove();
      rotated?.remove();
      if (Notifications) Notifications.setNotificationHandler(null);
    };
  }, [refresh]);

  const action = async (work) => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || acting.current) return;
    acting.current = true;
    revision.current += 1;
    setBusy(true);
    setError('');
    try {
      await work(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.data?.message || err.message || 'Amal bajarilmadi.');
      return;
    } finally {
      acting.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
    if (!controller.signal.aborted) refresh();
  };
  const preference = (channel, value) => action((signal) => api.put('/notifications/preferences', { [channel]: value }, { signal }));
  const unavailable = pushUnavailable();
  const enable = () => action(async () => { await registerPush(); });
  const disable = () => action(async (signal) => {
    await api.put('/notifications/preferences', { mobile: false }, { signal });
    await disconnectPush();
  });

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Bildirishnomalar: ${count} ta o‘qilmagan`} onPress={() => { setOpen(true); refresh(); }} style={styles.bell}>
      <Ionicons name="notifications-outline" size={25} color="#fff" />
      {count > 0 && <Text style={styles.badge}>{count > 99 ? '99+' : count}</Text>}
    </Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <View style={styles.panel} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleIcon}>
              <Ionicons name="notifications" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Bildirishnomalar</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Bildirishnoma sozlamalari" onPress={() => setSettings(!settings)} style={styles.icon}><Ionicons name="settings-outline" size={23} color={COLORS.primary} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Bildirishnomalarni yopish" onPress={() => setOpen(false)} style={styles.icon}><Ionicons name="close" size={25} color={COLORS.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {settings && <View style={styles.settings}>
              <Text style={styles.label}>Yetkazish kanallari</Text>
              <Text style={styles.hint}>Mobil push: {subscribed && config?.preferences?.mobile ? 'yoqilgan' : 'yoqilmagan'}</Text>
              {subscribed && <Pressable accessibilityRole="button" disabled={busy} style={styles.outline} onPress={()=>action(signal=>api.post('/notifications/test',{}, {signal}))}><Text>Sinov push xabari yuborish</Text></Pressable>}
              {!!unavailable && <Text style={styles.hint}>{unavailable}</Text>}
              <Pressable accessibilityRole="button" disabled={busy || !!unavailable || !config} style={[styles.button, (busy || !!unavailable || !config) && styles.disabled]} onPress={enable}><Text style={styles.buttonText}>Mobil pushni yoqish</Text></Pressable>
              {subscribed && <Pressable accessibilityRole="button" disabled={busy} style={styles.outline} onPress={disable}><Text>Mobil pushni o‘chirish</Text></Pressable>}
              <View style={styles.row}><Text>Telegram xabarlari</Text><Switch accessibilityLabel="Telegram xabarlari" disabled={busy || !config} value={!!config?.preferences?.telegram} onValueChange={(value) => preference('telegram', value)} /></View>
              <Text style={styles.hint}>{!config?.telegram?.configured ? 'Serverda Telegram hali sozlanmagan.' : config.telegram.linked ? 'Telegram hisobi bog‘langan.' : 'Telegram botga kirib hisobingizni bog‘lang.'}</Text>
            </View>}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.row}><Text style={styles.hint}>{count} ta o‘qilmagan</Text><Pressable accessibilityRole="button" disabled={busy || !count} onPress={() => action((signal) => api.put('/notifications/read-all', {}, { signal }))}><Text style={styles.link}>Barchasini o‘qish</Text></Pressable></View>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.outline} onPress={refresh}><Text>Yangilash</Text></Pressable>
            {(loading || busy) && <ActivityIndicator color={COLORS.primary} />}
            {!loading && !error && !items.length && <Text style={styles.empty}>Hozircha bildirishnomalar yo‘q.</Text>}
            {items.map((item) => <View key={item._id} style={[styles.item, !item.readAt && styles.unread]}>
              <Text style={styles.label}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.hint}>{new Date(item.createdAt).toLocaleString('uz-UZ')}</Text>
              {!item.readAt && <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}: o‘qilgan qilish`} disabled={busy} onPress={() => action((signal) => api.put(`/notifications/${item._id}/read`, {}, { signal }))} style={styles.read}><Text style={styles.link}>O‘qilgan qilish</Text></Pressable>}
            </View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

export default function NotificationCenter() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <Inbox key={user.id || user._id} />;
}

const styles = StyleSheet.create({
  bell: { position: 'absolute', right: 18, bottom: 96, width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.card, zIndex: 30, ...SHADOWS.float },
  badge: { position: 'absolute', right: -4, top: -5, backgroundColor: COLORS.red, color: '#fff', minWidth: 22, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 11, textAlign: 'center', fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 48 },
  panel: { width: '100%', maxWidth: 600, maxHeight: '90%', backgroundColor: '#fff', borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: Platform.OS === 'ios' ? 26 : 12 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginTop: 9 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.border },
  titleIcon: { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  title: { flex: 1, fontWeight: '800', fontSize: 19, color: COLORS.text }, icon: { padding: 8 },
  content: { padding: 16, gap: 12 }, settings: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: 14, gap: 10 },
  label: { color: COLORS.text, fontSize: 14.5, fontWeight: '700' }, body: { color: COLORS.text, lineHeight: 21, marginVertical: 7, fontSize: 13 }, hint: { color: COLORS.muted, fontSize: 11.5, lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  button: { backgroundColor: COLORS.primary, padding: 12, borderRadius: RADIUS.md, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 13 }, disabled: { opacity: 0.45 },
  outline: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center', padding: 10 },
  item: { padding: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border }, unread: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  link: { color: COLORS.primary, fontSize: 12.5, fontWeight: '700' }, read: { alignSelf: 'flex-end', paddingTop: 10 }, error: { color: COLORS.red, backgroundColor: '#fef2f2', padding: 12, borderRadius: RADIUS.md }, empty: { paddingVertical: 28, textAlign: 'center', color: COLORS.muted },
});
