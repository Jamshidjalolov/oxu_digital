import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../config';

export default function ProfileCard({ user, roleLabel, rows = [] }) {
  const initial = user && user.fullName ? user.fullName.charAt(0).toUpperCase() : '?';

  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        <LinearGradient
          colors={GRADIENTS.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        >
          <View pointerEvents="none" style={styles.circle} />
        </LinearGradient>

        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={['#3b82f6', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            {user?.avatar ? <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%', borderRadius: 50 }} /> : <Text style={styles.avatarText}>{initial}</Text>}
          </LinearGradient>
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {user ? user.fullName : ''}
          </Text>
          <View style={styles.rolePill}>
            <Ionicons name="shield-checkmark" size={11} color={COLORS.primary} />
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>

          {rows.length > 0 ? (
            <View style={styles.rows}>
              {rows.map((row) => (
                <View key={row.label + row.value} style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Ionicons name={row.icon} size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowValue} numberOfLines={1}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.card,
    ...SHADOWS.card,
  },
  card: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  cover: {
    height: 78,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
    right: -40,
    top: -70,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: -36,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.card,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 7,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  rows: {
    alignSelf: 'stretch',
    gap: 9,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 10,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 1,
  },
});
