import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
  Modal, FlatList, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { colors, spacing, radii, fonts } from '../../src/theme';

type Day = { day_id: string; name: string; exercise_ids: string[] };
type Exercise = { exercise_id: string; name: string; muscle_group: string };

const TEMPLATES: { [k: string]: string[] } = {
  'Push / Pull / Legs': ['Push', 'Pull', 'Legs'],
  'Upper / Lower': ['Upper', 'Lower'],
  'Bro Split': ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'],
  'Full Body': ['Full Body A', 'Full Body B', 'Full Body C'],
  'Custom': [],
};

function uid() { return `day_${Math.random().toString(36).slice(2, 10)}`; }

export default function SplitEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isEdit = id && id !== 'create';

  const [name, setName] = useState('My Split');
  const [days, setDays] = useState<Day[]>([]);
  const [template, setTemplate] = useState<string>('Custom');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const exRes = await api.get('/exercises');
      setExercises(exRes.data);
      if (isEdit) {
        const s = await api.get(`/splits/${id}`);
        setName(s.data.name);
        setDays(s.data.days);
      }
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => { loadData(); }, [loadData]);

  const applyTemplate = (tpl: string) => {
    setTemplate(tpl);
    if (tpl === 'Custom') return;
    const names = TEMPLATES[tpl] || [];
    setDays(names.map(n => ({ day_id: uid(), name: n, exercise_ids: [] })));
  };

  const addDay = () => setDays([...days, { day_id: uid(), name: `Day ${days.length + 1}`, exercise_ids: [] }]);
  const removeDay = (i: number) => setDays(days.filter((_, idx) => idx !== i));
  const updateDayName = (i: number, n: string) => setDays(days.map((d, idx) => idx === i ? { ...d, name: n } : d));
  const toggleExercise = (dayIdx: number, exId: string) => {
    setDays(days.map((d, idx) => {
      if (idx !== dayIdx) return d;
      const has = d.exercise_ids.includes(exId);
      return { ...d, exercise_ids: has ? d.exercise_ids.filter(x => x !== exId) : [...d.exercise_ids, exId] };
    }));
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Missing name', 'Please enter a split name.');
    if (days.length === 0) return Alert.alert('No days', 'Add at least one day.');
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/splits/${id}`, { name, days });
      } else {
        await api.post('/splits', { name, days });
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const getExerciseName = (eid: string) => exercises.find(e => e.exercise_id === eid)?.name || 'Exercise';

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={{ marginTop: 80 }} /></SafeAreaView>;

  const filteredEx = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="split-back-btn">
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'EDIT SPLIT' : 'NEW SPLIT'}</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} testID="save-split-btn">
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>SAVE</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
          <Text style={styles.label}>Split Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. PPL Routine"
            placeholderTextColor={colors.textDisabled}
            testID="split-name-input"
          />

          {!isEdit && (
            <>
              <Text style={styles.label}>Template</Text>
              <View style={styles.pillRow}>
                {Object.keys(TEMPLATES).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, template === t && styles.pillActive]}
                    onPress={() => applyTemplate(t)}
                    testID={`tpl-${t}`}
                  >
                    <Text style={[styles.pillText, template === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>DAYS</Text>
            <TouchableOpacity onPress={addDay} testID="add-day-btn">
              <Text style={styles.addText}>+ ADD DAY</Text>
            </TouchableOpacity>
          </View>

          {days.map((d, i) => (
            <View key={d.day_id} style={styles.dayCard} testID={`day-card-${i}`}>
              <View style={styles.dayHeader}>
                <TextInput
                  style={styles.dayName}
                  value={d.name}
                  onChangeText={t => updateDayName(i, t)}
                  testID={`day-name-${i}`}
                />
                <TouchableOpacity onPress={() => removeDay(i)}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {d.exercise_ids.map(eid => (
                <View key={eid} style={styles.exRow}>
                  <Ionicons name="barbell" size={14} color={colors.brand} />
                  <Text style={styles.exRowText}>{getExerciseName(eid)}</Text>
                  <TouchableOpacity onPress={() => toggleExercise(i, eid)}>
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addExBtn}
                onPress={() => { setActiveDayIndex(i); setPickerOpen(true); }}
                testID={`add-ex-btn-${i}`}
              >
                <Ionicons name="add" size={16} color={colors.brand} />
                <Text style={styles.addExText}>ADD EXERCISE</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>SELECT EXERCISES</Text>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={colors.textDisabled}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <FlatList
              data={filteredEx}
              keyExtractor={i => i.exercise_id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => {
                const selected = days[activeDayIndex]?.exercise_ids.includes(item.exercise_id);
                return (
                  <TouchableOpacity
                    style={[styles.pickerRow, selected && styles.pickerRowActive]}
                    onPress={() => toggleExercise(activeDayIndex, item.exercise_id)}
                    testID={`picker-${item.exercise_id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerMeta}>{item.muscle_group}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? colors.success : colors.textDisabled}
                    />
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.doneBtn} onPress={() => setPickerOpen(false)} testID="picker-done-btn">
              <Text style={styles.doneText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, letterSpacing: 2 },
  saveBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.lg },
  saveBtnText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
  label: { color: colors.textSecondary, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg },
  pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.textSecondary, fontFamily: fonts.bodyMedium, fontSize: 12 },
  pillTextActive: { color: '#fff' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 2 },
  addText: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 },
  dayCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  dayName: { flex: 1, color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, letterSpacing: 1 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  exRowText: { flex: 1, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  addExBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm, paddingVertical: 10, borderRadius: radii.lg, backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderStyle: 'dashed' },
  addExText: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderColor: colors.border, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textDisabled, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 2, marginBottom: spacing.md },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: { flex: 1, color: colors.textPrimary, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pickerRowActive: { backgroundColor: 'rgba(50,215,75,0.08)' },
  pickerName: { color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 14 },
  pickerMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  doneBtn: { marginTop: spacing.md, backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radii.lg, alignItems: 'center' },
  doneText: { color: '#fff', fontFamily: fonts.bodyBold, letterSpacing: 2 },
});
