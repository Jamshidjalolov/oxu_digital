import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PageHeader from '../../components/PageHeader';
import api from '../../api';
import {
  formatDateShort,
  COLORS,
  GRADIENTS,
  RADIUS,
  SHADOWS,
} from '../../config';

function StatChip({ label, value, icon }) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={13} color="rgba(255,255,255,0.9)" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function StudentAttendanceScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setError('');
      api
        .get('/student/attendance')
        .then((res) => {
          if (alive) setData(res.data);
        })
        .catch((e) => {
          if (alive) {
            setData(null);
            setError(e.response?.data?.message || 'Davomatni yuklab bo‘lmadi');
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [])
  );

  const records = (data && data.records) || [];
  const pct = data ? Math.max(0, Math.min(100, data.percentage || 0)) : 0;

  return (
    <View style={styles.flex}>
      <PageHeader
        icon="stats-chart"
        eyebrow="DAVOMAT"
        title="Mening davomatim"
        subtitle="Umumiy ko'rsatkich va darslar tarixi"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={GRADIENTS.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pctCard}
        >
          <View pointerEvents="none" style={styles.pctCircle} />
          <View style={styles.pctTop}>
            <View>
              <Text style={styles.pctEyebrow}>UMUMIY DAVOMAT</Text>
              <Text style={styles.pctNum}>{data ? `${data.percentage}%` : '—'}</Text>
            </View>
            <View style={styles.pctIcon}>
              <Ionicons name="trending-up" size={24} color={COLORS.white} />
            </View>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>

          <View style={styles.countsRow}>
            <StatChip
              icon="albums-outline"
              label="Jami"
              value={data ? data.total : '—'}
            />
            <StatChip
              icon="checkmark-circle-outline"
              label="Qatnashgan"
              value={data ? data.present : '—'}
            />
            <StatChip
              icon="close-circle-outline"
              label="Qatnashmagan"
              value={data ? data.absent : '—'}
            />
          </View>
        </LinearGradient>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Davomat tarixi</Text>
          {records.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{records.length} ta yozuv</Text>
            </View>
          ) : null}
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
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="clipboard-outline" size={30} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyText}>Hozircha davomat yozuvlari yo'q</Text>
          </View>
        ) : (
          records.map((r) => {
            const present = r.status === 'present';
            return (
              <View key={r.id || `${r.date}-${r.subject}`} style={styles.recordRow}>
                <View
                  style={[
                    styles.recordIcon,
                    { backgroundColor: present ? COLORS.greenBg : COLORS.redBg },
                  ]}
                >
                  <Ionicons
                    name={present ? 'checkmark' : 'close'}
                    size={17}
                    color={present ? COLORS.green : COLORS.red}
                  />
                </View>
                <View style={styles.recordBody}>
                  <Text style={styles.recordSubject} numberOfLines={1}>
                    {r.subject}
                  </Text>
                  <Text style={styles.recordDate}>{formatDateShort(r.date)}</Text>
                </View>
                <View
                  style={[
                    styles.recordPill,
                    { backgroundColor: present ? COLORS.greenBg : COLORS.redBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.recordStatus,
                      { color: present ? COLORS.green : COLORS.red },
                    ]}
                  >
                    {present ? 'Qatnashgan' : 'Qatnashmagan'}
                  </Text>
                </View>
              </View>
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
    padding: 16,
  },
  pctCard: {
    borderRadius: RADIUS.xl,
    padding: 20,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  pctCircle: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.08)',
    right: -50,
    top: -70,
  },
  pctTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pctEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pctNum: {
    color: COLORS.white,
    fontSize: 46,
    fontWeight: '800',
    marginTop: 2,
  },
  pctIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginTop: 12,
  },
  fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  countsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    gap: 2,
  },
  statValue: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9.5,
    fontWeight: '600',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
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
  loader: {
    marginTop: 30,
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
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: RADIUS.lg,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 9,
    ...SHADOWS.soft,
  },
  recordIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBody: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },
  recordSubject: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  recordDate: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  recordPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recordStatus: {
    fontSize: 10,
    fontWeight: '800',
  },
  bottomPad: {
    height: 104,
  },
});
