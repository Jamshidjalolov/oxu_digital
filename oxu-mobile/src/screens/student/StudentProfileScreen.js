import React from 'react';
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
import { COLORS, RADIUS, SHADOWS } from '../../config';

export default function StudentProfileScreen() {
  const { user, logout } = useAuth();

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
  if (user && user.group) {
    rows.push({ label: 'Guruh', value: user.group.name, icon: 'people-outline' });
  }

  return (
    <View style={styles.flex}>
      <PageHeader
        icon="person-outline"
        eyebrow="PROFIL"
        title="Mening profilim"
        subtitle="Shaxsiy ma'lumotlaringiz"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard user={user} roleLabel={user?.role === 'admin' ? 'Administrator' : 'Talaba'} rows={rows} />
        <ProfileEditor />

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
