import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import TeacherWeekBoard from '../../components/TeacherWeekBoard';
import WeekNavigator from '../../components/WeekNavigator';
import PressableScale from '../../components/PressableScale';
import useWeekSchedule from '../../hooks/useWeekSchedule';
import {
  addDays,
  getWeekStart,
  COLORS,
  RADIUS,
  SHADOWS,
} from '../../config';

const QUICK_STATS = [
  {
    key: 'yuklama',
    label: 'Yuklama',
    icon: 'time-outline',
    color: COLORS.primary,
    bg: '#eff6ff',
  },
  {
    key: 'stats',
    label: 'Davomat statistikasi',
    icon: 'bar-chart-outline',
    color: COLORS.accent,
    bg: '#f5f3ff',
  },
  {
    key: 'profile',
    label: 'Mening profilim',
    icon: 'person-outline',
    color: '#0891b2',
    bg: '#ecfeff',
  },
];

export default function TeacherHomeScreen({ navigation }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const { data, loading, error } = useWeekSchedule('/teacher/schedule', weekStart);

  const dates = (data && data.dates && data.dates.length)
    ? data.dates
    : [0, 1, 2, 3, 4, 5].map((i) => addDays(weekStart, i));
  const byDay = (data && data.byDay) || {};
  const total = dates.reduce((sum, d) => sum + (byDay[d] || []).length, 0);

  return (
    <View style={styles.flex}>
      <Header />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          {QUICK_STATS.map((s) => (
            <PressableScale
              key={s.key}
              style={styles.statBtn}
              onPress={() =>
                navigation.navigate(s.key === 'profile' ? 'Profile' : 'Davomat')
              }
            >
              <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={21} color={s.color} />
              </View>
              <Text style={styles.statLabel} numberOfLines={2}>
                {s.label}
              </Text>
            </PressableScale>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Haftalik jadval</Text>
          <View style={styles.countPill}>
            <Ionicons name="book-outline" size={12} color={COLORS.primary} />
            <Text style={styles.countText}>{total} ta dars</Text>
          </View>
        </View>

        <View style={styles.weekRow}>
          <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
        </View>

        {loading ? (
          <ActivityIndicator
            color={COLORS.primary}
            size="large"
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={COLORS.red} />
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error.response?.data?.message || 'Jadvalni yuklab bo‘lmadi'}
            </Text>
          </View>
        ) : (<TeacherWeekBoard dates={dates} byDay={byDay} onLesson={lesson => navigation.navigate('Attendance',{lessonId:lesson._id,lesson})} />)}
        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  weekRow: {
    marginBottom: 12,
  },
  loader: {
    marginTop: 40,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.redBg,
    borderRadius: RADIUS.md,
    padding: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.red,
  },
  bottomPad: {
    height: 104,
  },
});
