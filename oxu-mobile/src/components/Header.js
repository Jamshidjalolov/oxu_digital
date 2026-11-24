import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { COLORS, GRADIENTS, RADIUS, formatDateLong, toDateKey } from '../config';

const ROLE_LABELS = {
  admin: 'Administrator',
  teacher: "O'qituvchi",
  student: 'Talaba',
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Xayrli tong';
  if (hour < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}

export default function Header() {
  const { user } = useAuth();
  return (
    <LinearGradient
      colors={GRADIENTS.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View pointerEvents="none" style={styles.circleA} />
      <View pointerEvents="none" style={styles.circleB} />
      <View style={styles.textWrap}>
        <Text style={styles.hi}>{greeting()}</Text>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {user ? user.fullName : ''}
        </Text>
        <View style={styles.metaRow}>
          {user && ROLE_LABELS[user.role] ? (
            <View style={styles.roleChip}>
              <Ionicons name="shield-checkmark" size={11} color={COLORS.white} />
              <Text style={styles.roleText}>{ROLE_LABELS[user.role]}</Text>
            </View>
          ) : null}
          <View style={styles.dateChip}>
            <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.85)" />
            <Text style={styles.dateText}>{formatDateLong(toDateKey(new Date()))}</Text>
          </View>
        </View>
      </View>
      <View style={styles.logoCircle}>
        <Image
          source={require('../../assets/oxu-logo.png')}
          accessibilityLabel="Osiyo Xalqaro Universiteti"
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  circleA: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.09)',
    right: -70,
    top: -90,
  },
  circleB: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.07)',
    left: -35,
    bottom: -60,
  },
  textWrap: {
    flex: 1,
    marginRight: 14,
  },
  hi: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  name: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  roleText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  dateText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 44,
    height: 44,
  },
});
