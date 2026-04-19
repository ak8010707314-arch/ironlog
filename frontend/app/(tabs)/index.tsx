import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { useAuth } from '../../src/auth';
import { colors, spacing, radii, fonts } from '../../src/theme';

type Summary = {
  total_workouts: number;
  total_volume: number;
  streak_days: number;
  this_week_volume: number;
};

type Workout = {
  workout_id: string;
  day_name?: string | null;
  exercises: any[];
  total_volume: number;
  finished_at: string;
};

type Split = {
  split_id: string;
  name: string;
  days: { day_id: string; name: string; exercise_ids: string[] }[];
};

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Workout[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, w, sp] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/workouts', { params: { limit: 3 } }),
        api.get('/splits'),
      ]);
      setSummary(s.data);
      setRecent(w.data);
      setSplits(sp.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Welcome back,</Text>
            <Text style={styles.name} testID="home-username">
              {user?.name?.toUpperCase() || 'ATHLETE'}
            </Text>
          </View>
          {summary && summary.streak_days > 0 && (
            <View style={styles.streakBadge} testID="streak-badge">
              <Ionicons name="flame" size={16} color={colors.brand} />
              <Text style={styles.streakText}>{summary.streak_days} DAY</Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                label="Workouts"
                value={String(summary?.total_workouts ?? 0)}
                icon="barbell-outline"
                testID="stat-total-workouts"
              />
              <StatCard
                label="This Week"
                value={`${Math.round((summary?.this_week_volume ?? 0) / 1000)}k`}
                suffix="kg"
                icon="trending-up"
                testID="stat-week-volume"
              />
              <StatCard
                label="Total Volume"
                value={`${Math.round((summary?.total_volume ?? 0) / 1000)}k`}
                suffix="kg"
                icon="layers-outline"
                testID="stat-total-volume"
              />
              <StatCard
                label="Streak"
                value={String(summary?.streak_days ?? 0)}
                suffix="days"
                icon="flame-outline"
                testID="stat-streak"
              />
            </View>

            <TouchableOpacity
              style={styles.ctaCard}
              onPress={() => {
                if (splits.length === 0) {
                  router.push('/split/create');
                } else {
                  router.push('/(tabs)/splits');
                }
              }}
              activeOpacity={0.85}
              testID="home-start-workout-btn"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaLabel}>READY TO TRAIN?</Text>
                <Text style={styles.ctaTitle}>
                  {splits.length === 0 ? 'CREATE YOUR SPLIT' : 'START A WORKOUT'}
                </Text>
                <Text style={styles.ctaSub}>
                  {splits.length === 0
                    ? 'Build your first training split to begin logging.'
                    : 'Pick a day from your splits and go log some gains.'}
                </Text>
              </View>
              <View style={styles.ctaIcon}>
                <Ionicons name="arrow-forward" size={24} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RECENT WORKOUTS</Text>
              {recent.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
                  <Text style={styles.sectionLink}>View all</Text>
                </TouchableOpacity>
              )}
            </View>

            {recent.length === 0 ? (
              <View style={styles.empty} testID="home-empty-recent">
                <Ionicons name="barbell-outline" size={32} color={colors.textDisabled} />
                <Text style={styles.emptyText}>No workouts yet. Let&apos;s change that.</Text>
              </View>
            ) : (
              recent.map((w) => (
                <View key={w.workout_id} style={styles.recentCard} testID={`recent-${w.workout_id}`}>
                  <View style={styles.recentTop}>
                    <Text style={styles.recentTitle}>
                      {w.day_name?.toUpperCase() || 'WORKOUT'}
                    </Text>
                    <Text style={styles.recentDate}>{formatDate(w.finished_at)}</Text>
                  </View>
                  <View style={styles.recentStats}>
                    <Text style={styles.recentStat}>
                      <Text style={styles.recentStatNum}>{w.exercises.length}</Text> exercises
                    </Text>
                    <View style={styles.dot} />
                    <Text style={styles.recentStat}>
                      <Text style={styles.recentStatNum}>
                        {w.exercises.reduce(
                          (acc: number, e: any) => acc + (e.sets?.length ?? 0),
                          0
                        )}
                      </Text>{' '}
                      sets
                    </Text>
                    <View style={styles.dot} />
                    <Text style={styles.recentStat}>
                      <Text style={styles.recentStatNum}>{Math.round(w.total_volume)}</Text> kg
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
  testID,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: any;
  testID?: string;
}) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {suffix && <Text style={styles.statSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  hello: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13 },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 28,
    letterSpacing: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  streakText: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 6,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 28, letterSpacing: 1 },
  statSuffix: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginVertical: spacing.md,
  },
  ctaLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 2 },
  ctaTitle: { color: '#fff', fontFamily: fonts.heading, fontSize: 26, letterSpacing: 1.5, marginTop: 4 },
  ctaSub: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 2,
  },
  sectionLink: { color: colors.brand, fontFamily: fonts.bodyMedium, fontSize: 13 },
  empty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13 },
  recentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  recentTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 18, letterSpacing: 1 },
  recentDate: { color: colors.textSecondary, fontFamily: fonts.bodyMedium, fontSize: 12 },
  recentStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recentStat: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  recentStatNum: { color: colors.textPrimary, fontFamily: fonts.bodyBold },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textDisabled },
});
