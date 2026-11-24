import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../config';

export default function EmptyState({ icon = 'calendar-clear-outline', text }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={30} color={COLORS.primary} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: RADIUS.lg,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
  },
});
