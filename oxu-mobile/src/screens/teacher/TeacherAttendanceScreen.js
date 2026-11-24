import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../../components/PressableScale';
import api from '../../api';
import {
  formatDateLong,
  COLORS,
  GRADIENTS,
  RADIUS,
  SHADOWS,
} from '../../config';

const BTN_SIZE = 40;

function MarkButton({ active, activeColor, icon, onPress, disabled, label }) {
  return (
    <PressableScale
      style={[
        styles.markBtn,
        active && { backgroundColor: activeColor, borderColor: activeColor },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: !!disabled }}
      activeScale={0.88}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? '#ffffff' : activeColor}
      />
    </PressableScale>
  );
}

export default function TeacherAttendanceScreen({ route, navigation }) {
  const { lessonId, lesson: lessonParam } = route.params || {};
  const [lesson, setLesson] = useState(lessonParam || null);
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [past, setPast] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!lesson || locked) return;
    const update = () => { const now = Date.now(); setPast(!(now >= Date.parse(`${lesson.date}T${lesson.startTime}:00+05:00`) && now < Date.parse(`${lesson.date}T${lesson.endTime}:00+05:00`))); };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [lesson, locked]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoaded(false);
    setError('');
    setLocked(false);
    setPast(false);
    api
      .get(`/teacher/lessons/${lessonId}/attendance`)
      .then((res) => {
        if (!alive) return;
        setLesson(res.data.lesson);
        setStudents(res.data.students || []);
        setLocked(Boolean(res.data.attendanceLocked));
        setPast(res.data.attendanceAllowed === false);
        const map = {};
        (res.data.students || []).forEach((s) => {
          if (s.status) map[s.id] = s.status;
        });
        setStatuses(map);
        setLoaded(true);
      })
      .catch((e) => {
        if (alive) {
          setError(e.response?.data?.message || "Davomat ma'lumotlarini yuklab bo'lmadi");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    Object.values(statuses).forEach((s) => {
      if (s === 'present') present += 1;
      else if (s === 'absent') absent += 1;
    });
    const total = students.length;
    const pct = total ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, pct };
  }, [statuses, students]);

  const toggle = (id, status) => {
    if (locked || past) return;
    setStatuses((prev) => ({
      ...prev,
      [id]: prev[id] === status ? null : status,
    }));
  };

  const marked = counts.present + counts.absent;
  const complete = counts.total > 0 && marked === counts.total;
  const disabled = saving || loading || !loaded || locked || past || !complete;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) || String(s.id).includes(q)
    );
  }, [students, search]);

  const finish = async () => {
    if (locked || past) return;
    const records = Object.entries(statuses)
      .filter(([, st]) => st === 'present' || st === 'absent')
      .map(([studentId, status]) => ({ studentId, status }));
    setSaving(true);
    setError('');
    try {
      await api.put(`/teacher/lessons/${lessonId}/attendance`, { records });
      setLocked(true);
      if (Platform.OS === 'web') navigation.goBack();
      else Alert.alert('Muvaffaqiyatli', 'Davomat saqlandi va qulflandi', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      if (e.response?.status === 409) setLocked(true);
      setError(e.response?.data?.message || "Davomatni saqlab bo'lmadi. Qaytadan urinib ko'ring");
    } finally {
      setSaving(false);
    }
  };

  const finishColors = locked
    ? GRADIENTS.success
    : past
    ? ['#f59e0b', '#b45309']
    : GRADIENTS.primary;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={GRADIENTS.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsCard}
        >
          <View pointerEvents="none" style={styles.statsCircle} />
          {lesson ? (
            <Text style={styles.lessonTitle} numberOfLines={1}>
              {lesson.subject ? lesson.subject.name : ''} · {lesson.pairNumber}-para
            </Text>
          ) : null}
          {lesson ? (
            <Text style={styles.lessonSub} numberOfLines={1}>
              {formatDateLong(lesson.date)} · {lesson.startTime}–{lesson.endTime}
            </Text>
          ) : null}
          {lesson ? (
            <View style={styles.lessonMeta}>
              <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.lessonMetaText}>
                {lesson.building}, {lesson.room}-xona
              </Text>
            </View>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <View style={styles.statIconWrap}>
                <Ionicons name="people" size={18} color="#ffffff" />
              </View>
              <Text style={styles.statNum}>{counts.total}</Text>
              <Text style={styles.statLabel}>Barchasi</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.statIconWrap}>
                <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
              </View>
              <Text style={styles.statNum}>{counts.present}</Text>
              <Text style={styles.statLabel}>Qatnashdi</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.statIconWrap}>
                <Ionicons name="close-circle" size={18} color="#f87171" />
              </View>
              <Text style={styles.statNum}>{counts.absent}</Text>
              <Text style={styles.statLabel}>Qatnashmadi</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${counts.pct}%` }]} />
          </View>
          <View style={styles.pctRow}>
            <Text style={styles.pctLabel}>Belgilangan</Text>
            <Text style={styles.pct}>{counts.pct}%</Text>
          </View>
        </LinearGradient>

        {locked ? (
          <View style={styles.lockBox} accessibilityRole="alert">
            <Ionicons name="lock-closed" size={18} color={COLORS.green} />
            <Text style={styles.lockText}>
              Davomat olingan. Bu dars uchun davomat faqat bir marta olinadi va
              o‘zgartirilmaydi.
            </Text>
          </View>
        ) : past ? (
          <View style={styles.pastBox} accessibilityRole="alert">
            <Ionicons name="ban" size={18} color="#92400e" />
            <Text style={styles.pastText}>
              Davomat faqat dars kuni {lesson?.startTime}–{lesson?.endTime} oralig‘ida olinadi (Toshkent vaqti).
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Talabalar</Text>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{counts.total} ta</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Talaba nomi yoki ID bo'yicha qidiring"
            placeholderTextColor={COLORS.gray}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <PressableScale onPress={() => setSearch('')} activeScale={0.85}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </PressableScale>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator
            color={COLORS.primary}
            size="large"
            style={styles.loader}
          />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>Talaba topilmadi</Text>
        ) : (
          filtered.map((s) => {
            const st = statuses[s.id];
            return (
              <View key={s.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {s.fullName ? s.fullName.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {s.fullName}
                  </Text>
                  <Text style={styles.rowId}>ID: {s.id}</Text>
                </View>
                <View style={styles.markGroup}>
                  <MarkButton
                    icon={st === 'present' ? 'checkmark' : 'checkmark-outline'}
                    activeColor={COLORS.green}
                    active={st === 'present'}
                    onPress={() => toggle(s.id, 'present')}
                    label={`${s.fullName}: Qatnashdi`}
                    disabled={saving || locked || past}
                  />
                  <MarkButton
                    icon="close"
                    activeColor={COLORS.red}
                    active={st === 'absent'}
                    onPress={() => toggle(s.id, 'absent')}
                    label={`${s.fullName}: Qatnashmadi`}
                    disabled={saving || locked || past}
                  />
                </View>
              </View>
            );
          })
        )}
        <View style={styles.bottomPad} />
      </ScrollView>

      <View style={styles.footer}>
        {error ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
        ) : null}
        {!locked && !past && counts.total > 0 && !complete ? (
          <Text style={styles.hint}>
            Yakunlash uchun barcha talabalarni belgilang ({marked}/{counts.total})
          </Text>
        ) : null}
        <PressableScale
          style={[styles.finishWrap, disabled && styles.finishDisabled]}
          onPress={finish}
          disabled={disabled}
          accessibilityLabel={locked ? 'Davomat olingan' : past ? 'Davomat vaqti yopiq' : 'Yakunlash'}
          accessibilityState={{ disabled }}
        >
          <LinearGradient colors={finishColors} style={styles.finishBtn}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name={locked ? 'lock-closed' : past ? 'ban' : 'checkmark-done'}
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.finishText}>
                  {locked ? 'Davomat olingan' : past ? 'Davomat vaqti yopiq' : 'Yakunlash'}
                </Text>
              </>
            )}
          </LinearGradient>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  statsCard: {
    borderRadius: RADIUS.xl,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  statsCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    right: -50,
    top: -70,
  },
  lessonTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  lessonSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    marginTop: 3,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    marginBottom: 16,
  },
  lessonMetaText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    marginHorizontal: 3,
  },
  statIconWrap: {
    marginBottom: 4,
  },
  statNum: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  pctLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
  },
  pct: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  lockBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 16,
  },
  lockText: {
    flex: 1,
    color: '#047857',
    fontSize: 12.5,
    lineHeight: 18,
  },
  pastBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 16,
  },
  pastText: {
    flex: 1,
    color: '#92400e',
    fontSize: 12.5,
    lineHeight: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  countPill: {
    backgroundColor: COLORS.grayBg,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.muted,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.text,
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.muted,
    marginTop: 32,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 9,
    ...SHADOWS.soft,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  rowBody: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  rowName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  rowId: {
    fontSize: 10.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  markGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  markBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.grayBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPad: {
    height: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 14,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  errorText: {
    color: COLORS.red,
    marginBottom: 10,
    fontSize: 13,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  finishWrap: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.float,
  },
  finishDisabled: {
    opacity: 0.65,
  },
  finishBtn: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
