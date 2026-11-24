import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS } from '../../config';

export default function TeacherPlaceholderScreen({ route }) {
  const { title = 'OXU Digital', icon = 'bar-chart-outline', color = COLORS.primary } =
    route.params || {};

  return (
    <LinearGradient
      colors={GRADIENTS.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.flex}
    >
      <View pointerEvents="none" style={styles.circleA} />
      <View pointerEvents="none" style={styles.circleB} />
      <View style={styles.center}>
        <View style={[styles.iconCircle, { backgroundColor: `${color}33` }]}>
          <Ionicons name={icon} size={44} color="#ffffff" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.pill}>
          <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.sub}>Tez orada mavjud bo'ladi</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  circleA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    right: -80,
  },
  circleB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -60,
    left: -60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
  },
  sub: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
