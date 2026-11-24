import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../config';

export default function PageHeader({
  title,
  subtitle,
  eyebrow = 'OXU DIGITAL',
  icon,
  right,
}) {
  return (
    <LinearGradient
      colors={GRADIENTS.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}
    >
      <View pointerEvents="none" style={styles.circleA} />
      <View pointerEvents="none" style={styles.circleB} />
      <View style={styles.row}>
        {icon ? (
          <View style={styles.iconChip}>
            <Ionicons name={icon} size={22} color={COLORS.white} />
          </View>
        ) : null}
        <View style={styles.textWrap}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  circleA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.09)',
    right: -60,
    top: -80,
  },
  circleB: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
    left: -40,
    bottom: -70,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...SHADOWS.soft,
  },
  textWrap: {
    flex: 1,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  right: {
    marginLeft: 12,
  },
});
