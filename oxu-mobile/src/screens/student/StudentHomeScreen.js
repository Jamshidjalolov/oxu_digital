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
import WeekNavigator from '../../components/WeekNavigator';
import DaySection from '../../components/DaySection';
import LessonCard from '../../components/LessonCard';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import useWeekSchedule from '../../hooks/useWeekSchedule';
import {
  addDays,
  getWeekStart,
  COLORS,
  RADIUS,
  SHADOWS,
} from '../../config';

export default function StudentHomeScreen() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const { data, loading, error } = useWeekSchedule('/student/schedule', weekStart);

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
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="sparkles" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoBody}>
            <Text style={styles.infoTitle}>Davomatingiz nazorati</Text>
            <Text style={styles.infoText}>
              Har bir dars kartasida qatnashuv holati ko'rsatiladi.
            </Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Dars jadvali</Text>
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
        ) : (
          dates.map((d) => {
            const lessons = byDay[d] || [];
            return (
              <DaySection key={d} dateKey={d} count={lessons.length}>
                {lessons.length === 0 ? (
                  <EmptyState text="Bu kunga dars yo'q" />
                ) : (
                  lessons.map((lesson) => (
                    <LessonCard
                      key={lesson._id}
                      lesson={lesson}
                      badge={<StatusBadge status={lesson.myStatus} />}
                    />
                  ))
                )}
              </DaySection>
            );
          })
        )}
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 20,
    ...SHADOWS.soft,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBody: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  infoText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: COLORS.muted,
    marginTop: 2,
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
