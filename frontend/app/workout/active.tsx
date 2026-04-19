import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { colors, spacing, radii, fonts } from '../../src/theme';

type Set = { set_number: number; weight: string; reps: string; completed: boolean };
type Ex = { exercise_id: string; exercise_name: string; sets: Set[]; suggestion?: any; lastTop?: any };

const REST_SECONDS = 90;

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function ActiveWorkout() {
  const router = useRouter();
  const { split_id, day_name, exercise_ids } = useLocalSearchParams<{
    split_id?: string; day_name?: string; exercise_ids?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exercises, setExercises] = useState<Ex[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const startedAtRef = useRef<Date>(new Date());

  // Timer for total elapsed
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Rest timer countdown
  useEffect(() => {
    if (restLeft <= 0) return;
    const t = setInterval(() => setRestLeft(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [restLeft]);

  const init = useCallback(async () => {
    if (!exercise_ids) { setLoading(false); return; }
    const ids = exercise_ids.split(',').filter(Boolean);
    try {
      const all = await api.get('/exercises');
      const exMap = new Map<string, any>(all.data.map((e: any) => [e.exercise_id, e]));
      const results: Ex[] = [];
      for (const id of ids) {
        const ex = exMap.get(id);
        if (!ex) continue;
        let suggestion = null;
        let lastTop = null;
        try {
          const r = await api.get(`/workouts/last/${id}`);
          if (r.data.found) {
            suggestion = r.data.suggestion;
            lastTop = r.data.top_set;
          }
        } catch { /* ignore */ }
        const initialW = suggestion?.weight ?? '';
        const initialR = suggestion?.reps ?? '';
        results.push({
          exercise_id: id,
          exercise_name: ex.name,
          suggestion,
          lastTop,
          sets: [
            { set_number: 1, weight: String(initialW), reps: String(initialR), completed: false },
            { set_number: 2, weight: String(initialW), reps: String(initialR), completed: false },
            { set_number: 3, weight: String(initialW), reps: String(initialR), completed: false },
          ],
        });
      }
      setExercises(results);
    } finally {
      setLoading(false);
    }
  }, [exercise_ids]);

  useEffect(() => { init(); }, [init]);

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setExercises(ex => ex.map((e, i) => {
      if (i !== exIdx) return e;
      return { ...e, sets: e.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s) };
    }));
  };

  const toggleSet = (exIdx: number, setIdx: number) => {
    setExercises(ex => ex.map((e, i) => {
      if (i !== exIdx) return e;
      return { ...e, sets: e.sets.map((s, j) => j === setIdx ? { ...s, completed: !s.completed } : s) };
    }));
    const target = exercises[exIdx]?.sets[setIdx];
    if (target && !target.completed) {
      setRestLeft(REST_SECONDS);
    }
  };

  const addSet = (exIdx: number) => {
    setExercises(ex => ex.map((e, i) => {
      if (i !== exIdx) return e;
      const last = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, { set_number: e.sets.length + 1, weight: last?.weight || '', reps: last?.reps || '', completed: false }] };
    }));
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises(ex => ex.map((e, i) => {
      if (i !== exIdx) return e;
      return { ...e, sets: e.sets.filter((_, j) => j !== setIdx).map((s, k) => ({ ...s, set_number: k + 1 })) };
    }));
  };

  const totalCompleted = useMemo(() => exercises.reduce((acc, e) => acc + e.sets.filter(s => s.completed).length, 0), [exercises]);
  const totalVolume = useMemo(() => exercises.reduce((acc, e) => acc + e.sets.reduce((a, s) => a + (s.completed ? (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0) : 0), 0), 0), [exercises]);

  const finish = async () => {
    if (totalCompleted === 0) {
      return Alert.alert('No completed sets', 'Complete at least one set before finishing.');
    }
    setSaving(true);
    try {
      const finishedAt = new Date();
      const payload = {
        split_id: split_id || null,
        day_name: day_name || null,
        duration_seconds: elapsed,
        started_at: startedAtRef.current.toISOString(),
        finished_at: finishedAt.toISOString(),
        exercises: exercises.map(e => ({
          exercise_id: e.exercise_id,
          exercise_name: e.exercise_name,
          sets: e.sets
            .filter(s => s.completed)
            .map((s, i) => ({
              set_number: i + 1,
              weight: parseFloat(s.weight) || 0,
              reps: parseInt(s.reps) || 0,
              completed: true,
            })),
        })).filter(e => e.sets.length > 0),
      };
      await api.post('/workouts', payload);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not save workout');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    Alert.alert('Discard workout?', 'All progress will be lost.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={{ marginTop: 80 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={cancel} testID="workout-cancel-btn">
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.dayName}>{(day_name || 'WORKOUT').toUpperCase()}</Text>
            <Text style={styles.elapsed}>{fmtTime(elapsed)}</Text>
          </View>
          <TouchableOpacity style={styles.finishBtn} onPress={finish} disabled={saving} testID="workout-finish-btn">
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.finishText}>FINISH</Text>}
          </TouchableOpacity>
        </View>

        {restLeft > 0 && (
          <View style={styles.restBar} testID="rest-timer">
            <Ionicons name="timer-outline" size={16} color="#fff" />
            <Text style={styles.restText}>REST {fmtTime(restLeft)}</Text>
            <TouchableOpacity onPress={() => setRestLeft(0)} testID="skip-rest-btn">
              <Text style={styles.skipText}>SKIP</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.statItem}><Text style={styles.statVal}>{totalCompleted}</Text><Text style={styles.statLbl}>SETS</Text></View>
          <View style={styles.statSep} />
          <View style={styles.statItem}><Text style={styles.statVal}>{Math.round(totalVolume)}</Text><Text style={styles.statLbl}>VOLUME (KG)</Text></View>
          <View style={styles.statSep} />
          <View style={styles.statItem}><Text style={styles.statVal}>{exercises.length}</Text><Text style={styles.statLbl}>EXERCISES</Text></View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
          {exercises.length === 0 ? (
            <Text style={styles.emptyText}>No exercises selected.</Text>
          ) : exercises.map((ex, exIdx) => (
            <View key={ex.exercise_id} style={styles.exCard} testID={`active-ex-${ex.exercise_id}`}>
              <Text style={styles.exName}>{ex.exercise_name.toUpperCase()}</Text>
              {ex.suggestion && (
                <View style={styles.suggestBadge}>
                  <Ionicons name="trending-up" size={12} color={colors.success} />
                  <Text style={styles.suggestText}>
                    Last: {ex.lastTop?.weight}kg × {ex.lastTop?.reps} · Try {ex.suggestion.weight}kg × {ex.suggestion.reps} ({ex.suggestion.reason})
                  </Text>
                </View>
              )}

              <View style={styles.setsHeader}>
                <Text style={[styles.headCell, { flex: 0.5 }]}>SET</Text>
                <Text style={[styles.headCell, { flex: 1 }]}>KG</Text>
                <Text style={[styles.headCell, { flex: 1 }]}>REPS</Text>
                <Text style={[styles.headCell, { width: 40, textAlign: 'center' }]}>✓</Text>
                <View style={{ width: 24 }} />
              </View>

              {ex.sets.map((s, setIdx) => (
                <View key={setIdx} style={[styles.setRow, s.completed && styles.setRowDone]}>
                  <Text style={[styles.cell, { flex: 0.5, textAlign: 'center', color: colors.textSecondary }]}>
                    {setIdx + 1}
                  </Text>
                  <TextInput
                    style={[styles.cellInput, { flex: 1 }]}
                    value={s.weight}
                    onChangeText={t => updateSet(exIdx, setIdx, 'weight', t)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textDisabled}
                    testID={`weight-${exIdx}-${setIdx}`}
                  />
                  <TextInput
                    style={[styles.cellInput, { flex: 1 }]}
                    value={s.reps}
                    onChangeText={t => updateSet(exIdx, setIdx, 'reps', t)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textDisabled}
                    testID={`reps-${exIdx}-${setIdx}`}
                  />
                  <TouchableOpacity
                    style={[styles.checkbox, s.completed && styles.checkboxDone]}
                    onPress={() => toggleSet(exIdx, setIdx)}
                    testID={`check-${exIdx}-${setIdx}`}
                  >
                    {s.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeSet(exIdx, setIdx)} style={{ width: 24, alignItems: 'center' }}>
                    <Ionicons name="remove-circle-outline" size={18} color={colors.textDisabled} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addSet} onPress={() => addSet(exIdx)} testID={`add-set-${exIdx}`}>
                <Ionicons name="add" size={14} color={colors.brand} />
                <Text style={styles.addSetText}>ADD SET</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayName: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 18, letterSpacing: 2 },
  elapsed: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
  finishBtn: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.lg },
  finishText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
  restBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brand, paddingVertical: 10 },
  restText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 2 },
  skipText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, textDecorationLine: 'underline', marginLeft: spacing.md },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  statItem: { alignItems: 'center' },
  statVal: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1 },
  statLbl: { color: colors.textSecondary, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  statSep: { width: 1, height: 24, backgroundColor: colors.border },
  emptyText: { color: colors.textSecondary, textAlign: 'center', fontFamily: fonts.body, marginTop: spacing.xl },
  exCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md },
  exName: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, letterSpacing: 1 },
  suggestBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: 'rgba(50,215,75,0.08)', borderWidth: 1, borderColor: 'rgba(50,215,75,0.3)', borderRadius: radii.sm },
  suggestText: { color: colors.success, fontFamily: fonts.bodyMedium, fontSize: 11, flex: 1 },
  setsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, marginTop: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headCell: { color: colors.textSecondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: spacing.sm },
  setRowDone: { opacity: 0.95 },
  cell: { fontFamily: fonts.body, color: colors.textPrimary, fontSize: 14 },
  cellInput: { backgroundColor: colors.inputBg, borderRadius: radii.sm, paddingVertical: 10, color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 15, textAlign: 'center' },
  checkbox: { width: 32, height: 32, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.sm, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: 'rgba(255,59,48,0.08)' },
  addSetText: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
});
