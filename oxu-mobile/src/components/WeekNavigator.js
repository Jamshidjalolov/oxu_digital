import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import {
  addDays,
  formatDateShort,
  getWeekStart,
  COLORS,
  RADIUS,
  SHADOWS,
} from '../config';

export default function WeekNavigator({ weekStart, onChange }) {
  const isCurrent = weekStart === getWeekStart();

  return (
    <View style={styles.wrap}>
      <PressableScale
        style={styles.arrow}
        onPress={() => onChange(addDays(weekStart, -7))}
        accessibilityLabel="Oldingi hafta"
        activeScale={0.9}
      >
        <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
      </PressableScale>

      <View style={styles.center}>
        <View style={styles.calIcon}>
          <Ionicons name="calendar" size={15} color={COLORS.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.caption}>{isCurrent ? 'Joriy hafta' : 'Hafta'}</Text>
          <Text style={styles.label}>
            {formatDateShort(weekStart)} — {formatDateShort(addDays(weekStart, 5))}
          </Text>
        </View>
      </View>

      <PressableScale
        style={styles.arrow}
        onPress={() => onChange(addDays(weekStart, 7))}
        accessibilityLabel="Keyingi hafta"
        activeScale={0.9}
      >
        <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 8,
    paddingVertical: 8,
    ...SHADOWS.soft,
  },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.grayBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 6,
  },
  calIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    alignItems: 'flex-start',
  },
  caption: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 1,
  },
});
