import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PageHeader from '../../components/PageHeader';
import WeekNavigator from '../../components/WeekNavigator';
import DaySection from '../../components/DaySection';
import LessonCard from '../../components/LessonCard';
import EmptyState from '../../components/EmptyState';
import useWeekSchedule from '../../hooks/useWeekSchedule';
import api from '../../api';
import {
  addDays,
  getWeekStart,
  COLORS,
  RADIUS,
} from '../../config';

function StatusBadge({ taken }) {
  return (
    <View
      style={[
        styles.badge,
        taken === true && { backgroundColor: COLORS.greenBg },
        taken === false && { backgroundColor: COLORS.grayBg },
      ]}
    >
      <Ionicons
        name={taken ? 'checkmark-circle' : 'ellipse-outline'}
        size={13}
        color={taken ? COLORS.green : COLORS.muted}
      />
      <Text
        style={[
          styles.badgeText,
          { color: taken ? COLORS.green : COLORS.muted },
        ]}
      >
        {taken ? 'Davomat olindi' : 'Davomat olinmadi'}
      </Text>
    </View>
  );
}

export default function TeacherDavomatScreen({ navigation }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const { data, loading, error } = useWeekSchedule('/teacher/schedule', weekStart);
  // lessonId → true/false (davomat olinganmi)
  const [takenMap, setTakenMap] = useState({});

  const dates = (data && data.dates && data.dates.length)
    ? data.dates
    : [0, 1, 2, 3, 4, 5].map((i) => addDays(weekStart, i));
  const byDay = (data && data.byDay) || {};

  const allLessons = dates.reduce((acc, d) => acc.concat(byDay[d] || []), []);
  const takenCount = allLessons.filter((lesson) => takenMap[lesson._id]).length;

  // Hafta o'zgarganda har bir dars uchun davomat holatini yuklash
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setTakenMap({});
      if (allLessons.length === 0) return undefined;
      Promise.all(
        allLessons.map((l) =>
          api
            .get(`/teacher/lessons/${l._id}/attendance`)
            .then((res) => ({
              id: l._id,
              taken: Boolean(res.data.attendanceLocked ?? (res.data.students || []).some((s) => s.status)),
            }))
            .catch(() => ({ id: l._id, taken: false }))
        )
      ).then((results) => {
        if (!alive) return;
        const map = {};
        results.forEach((r) => {
          map[r.id] = r.taken;
        });
        setTakenMap(map);
      });
      return () => {
        alive = false;
      };
    }, [weekStart, data])
  );

  return (
    <View style={styles.flex}>
      <PageHeader
        icon="checkbox-outline"
        eyebrow="DAVOMAT"
        title="Davomat olish"
        subtitle="Darsni tanlang va talabalar ro'yxatini belgilang"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Haftalik jadval</Text>
          <View style={styles.countPill}>
            <Ionicons name="checkmark-done-outline" size={12} color={COLORS.green} />
            <Text style={styles.countText}>
              {takenCount}/{allLessons.length} olingan
            </Text>
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
                      onPress={() =>
                        navigation.navigate('Attendance', {
                          lessonId: lesson._id,
                          lesson,
                        })
                      }
                      badge={<StatusBadge taken={takenMap[lesson._id]} />}
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
    backgroundColor: COLORS.greenBg,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.green,
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  bottomPad: {
    height: 104,
  },
});
