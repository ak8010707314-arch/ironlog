import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { colors, spacing, radii, fonts } from '../../src/theme';

const W = Dimensions.get('window').width - spacing.md * 2;

type PR = { exercise_id: string; exercise_name: string; weight: number; reps: number; date: string };
type StrengthPoint = { date: string; weight: number; reps: number };

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (o = 1) => `rgba(255,255,255,${o})`,
  labelColor: (o = 1) => `rgba(161,161,170,${o})`,
  propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.08)' },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF3B30' },
};

export default function Analytics() {
  const [prs, setPrs] = useState<PR[]>([]);
  const [weeks, setWeeks] = useState<{ week: string; volume: number }[]>([]);
  const [selectedEx, setSelectedEx] = useState<PR | null>(null);
  const [strength, setStrength] = useState<StrengthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [prRes, volRes] = await Promise.all([api.get('/analytics/prs'), api.get('/analytics/volume')]);
      setPrs(prRes.data.prs);
      setWeeks(volRes.data.weeks);
      if (prRes.data.prs.length > 0 && !selectedEx) setSelectedEx(prRes.data.prs[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedEx]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!selectedEx) return;
    api.get(`/analytics/strength/${selectedEx.exercise_id}`).then(r => setStrength(r.data.points));
  }, [selectedEx]);

  const hasData = prs.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        <Text style={styles.eyebrow}>YOUR PROGRESS</Text>
        <Text style={styles.title}>ANALYTICS</Text>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : !hasData ? (
          <View style={styles.empty}>
            <Ionicons name="stats-chart-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>NO DATA YET</Text>
            <Text style={styles.emptySub}>Log your first workout to see progress charts and PRs here.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>WEEKLY VOLUME (8W)</Text>
            {weeks.length > 0 ? (
              <View style={styles.chartCard}>
                <BarChart
                  data={{
                    labels: weeks.map(w => w.week.split('-W')[1]),
                    datasets: [{ data: weeks.map(w => Math.round(w.volume / 1000)) }],
                  }}
                  width={W - spacing.md * 2}
                  height={180}
                  yAxisLabel=""
                  yAxisSuffix="k"
                  chartConfig={{
                    ...chartConfig,
                    color: (o = 1) => `rgba(255,59,48,${o})`,
                  }}
                  fromZero
                  style={styles.chart}
                />
              </View>
            ) : (
              <View style={styles.chartCard}><Text style={styles.emptySub}>Log workouts to see volume trends.</Text></View>
            )}

            <Text style={styles.sectionTitle}>STRENGTH PROGRESS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
              {prs.slice(0, 10).map(pr => (
                <TouchableOpacity
                  key={pr.exercise_id}
                  style={[styles.exChip, selectedEx?.exercise_id === pr.exercise_id && styles.exChipActive]}
                  onPress={() => setSelectedEx(pr)}
                  testID={`strength-chip-${pr.exercise_id}`}
                >
                  <Text style={[styles.exChipText, selectedEx?.exercise_id === pr.exercise_id && styles.exChipTextActive]}>
                    {pr.exercise_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedEx && strength.length > 1 ? (
              <View style={styles.chartCard}>
                <LineChart
                  data={{
                    labels: strength.slice(-6).map(p => new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                    datasets: [{ data: strength.slice(-6).map(p => p.weight) }],
                  }}
                  width={W - spacing.md * 2}
                  height={200}
                  yAxisSuffix="kg"
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                />
              </View>
            ) : (
              <View style={styles.chartCard}>
                <Text style={styles.emptySub}>Log {selectedEx?.exercise_name || 'this exercise'} more than once to see progress.</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>PERSONAL RECORDS</Text>
            {prs.map((pr, idx) => (
              <View key={pr.exercise_id} style={styles.prRow} testID={`pr-${pr.exercise_id}`}>
                <View style={styles.prRank}><Text style={styles.prRankText}>{idx + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prName}>{pr.exercise_name}</Text>
                  <Text style={styles.prMeta}>{pr.reps} reps · {new Date(pr.date).toLocaleDateString()}</Text>
                </View>
                <View style={styles.prWeightWrap}>
                  <Text style={styles.prWeight}>{pr.weight}</Text>
                  <Text style={styles.prUnit}>kg</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  eyebrow: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 34, letterSpacing: 2, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 2, marginTop: spacing.lg, marginBottom: spacing.sm },
  chartCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, padding: spacing.md, alignItems: 'center' },
  chart: { borderRadius: radii.lg, marginLeft: -spacing.md },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, marginTop: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 2 },
  emptySub: { color: colors.textSecondary, fontFamily: fonts.body, textAlign: 'center', maxWidth: 320 },
  exChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  exChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  exChipText: { color: colors.textSecondary, fontFamily: fonts.bodyMedium, fontSize: 12 },
  exChipTextActive: { color: '#fff' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm },
  prRank: { width: 32, height: 32, borderRadius: radii.pill, backgroundColor: 'rgba(255,59,48,0.12)', alignItems: 'center', justifyContent: 'center' },
  prRankText: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 13 },
  prName: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 14 },
  prMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  prWeightWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  prWeight: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1 },
  prUnit: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 11 },
});
