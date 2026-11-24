import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from './PressableScale';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../config';

const TYPE_STYLES = {
  "Ma'ruza": { color: COLORS.primary, gradient: GRADIENTS.primary },
  Amaliyot: { color: COLORS.green, gradient: GRADIENTS.success },
  Laboratoriya: { color: COLORS.accent, gradient: GRADIENTS.violet },
};

export default function LessonCard({ lesson, onPress, badge }) {
  const type = TYPE_STYLES[lesson.type] || TYPE_STYLES["Ma'ruza"];
  const groups = lesson.groups || [];

  return (
    <PressableScale
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      activeScale={0.98}
      accessibilityLabel={lesson.subject ? lesson.subject.name : 'Dars'}
    >
      <LinearGradient
        colors={type.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.timeBlock}
      >
        <Text style={styles.pair}>{lesson.pairNumber}-PARA</Text>
        <Text style={styles.timeText}>{lesson.startTime}</Text>
        <View style={styles.timeDivider} />
        <Text style={styles.timeText}>{lesson.endTime}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.subject} numberOfLines={1}>
          {lesson.subject ? lesson.subject.name : ''}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={COLORS.muted} />
          <Text style={styles.meta} numberOfLines={1}>
            {lesson.building} · {lesson.room}-xona
          </Text>
        </View>

        {groups.length > 0 ? (
          <View style={styles.groupRow}>
            {groups.map((g) => (
              <View key={g._id || g.id || g.name} style={styles.groupBadge}>
                <Text style={styles.groupText}>{g.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.typeBadge, { backgroundColor: `${type.color}14` }]}>
          <View style={[styles.typeDot, { backgroundColor: type.color }]} />
          <Text style={[styles.typeText, { color: type.color }]}>{lesson.type}</Text>
        </View>
      </View>

      {badge ? <View style={styles.badgeCol}>{badge}</View> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  timeBlock: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 66,
  },
  pair: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  timeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  timeDivider: {
    width: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginVertical: 4,
  },
  body: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  subject: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  meta: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.muted,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  groupBadge: {
    backgroundColor: COLORS.grayBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  groupText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
    marginTop: 7,
  },
  typeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeCol: {
    justifyContent: 'center',
    marginLeft: 8,
  },
});
