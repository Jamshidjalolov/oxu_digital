import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PageHeader from '../../components/PageHeader';
import ProfileCard from '../../components/ProfileCard';
import ProfileEditor from '../../components/ProfileEditor';
import PressableScale from '../../components/PressableScale';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { COLORS, RADIUS, SHADOWS } from '../../config';

const STAT_ITEMS = [
  { key: 'total', label: 'Jami belgi', icon: 'people', color: COLORS.primary, bg: '#eff6ff' },
  { key: 'present', label: 'Qatnashdi', icon: 'checkmark-circle', color: COLORS.green, bg: COLORS.greenBg },
  { key: 'absent', label: 'Qatnashmadi', icon: 'close-circle', color: COLORS.red, bg: COLORS.redBg },
];

export default function TeacherProfileScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/teacher/stats')
      .then((res) => {
        if (alive) setStats(res.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Hisobingizdan chiqmoqchimisiz?')) logout();
      return;
    }
    Alert.alert('Chiqish', 'Hisobingizdan chiqmoqchimisiz?', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Chiqish', style: 'destructive', onPress: logout },
    ]);
  };

  const rows = [{ label: 'Telefon', value: user ? user.phone : '', icon: 'call-outline' }];

  return (
    <View style={styles.flex}>
      <PageHeader
        icon="person-outline"
        eyebrow="PROFIL"
        title="Mening profilim"
        subtitle="Hisob va davomat ko'rsatkichlari"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard user={user} roleLabel="O'qituvchi" rows={rows} />
        <ProfileEditor />

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Davomat statistikasi</Text>
        </View>
        <View style={styles.statsRow}>
          {STAT_ITEMS.map((item) => (
            <View key={item.key} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={[styles.statNum, { color: item.color }]}>
                {stats ? stats[item.key] : '—'}
              </Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <PressableScale
          style={styles.logoutBtn}
          onPress={confirmLogout}
          accessibilityLabel="Hisobdan chiqish"
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.red} />
          <Text style={styles.logoutText}>Hisobdan chiqish</Text>
        </PressableScale>
        <Text style={styles.version}>OXU Digital v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: 16,
    paddingBottom: 110,
  },
  sectionRow: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
    ...SHADOWS.soft,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    height: 52,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
    ...SHADOWS.soft,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.red,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 16,
  },
});
