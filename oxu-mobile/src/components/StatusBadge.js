import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../config';

const MAP = {
  present: {
    label: 'Qatnashdi',
    color: COLORS.green,
    bg: COLORS.greenBg,
    icon: 'checkmark-circle',
  },
  absent: {
    label: 'Qatnashmadi',
    color: COLORS.red,
    bg: COLORS.redBg,
    icon: 'close-circle',
  },
  pending: {
    label: 'Kutilmoqda',
    color: COLORS.muted,
    bg: COLORS.grayBg,
    icon: 'time-outline',
  },
};

/** status: "present" | "absent" | null */
export default function StatusBadge({ status }) {
  const conf = MAP[status] || MAP.pending;
  return (
    <View style={[styles.badge, { backgroundColor: conf.bg }]}>
      <Ionicons name={conf.icon} size={13} color={conf.color} />
      <Text style={[styles.text, { color: conf.color }]}>{conf.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
  },
});
