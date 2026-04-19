import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { colors, spacing, radii, fonts } from '../../src/theme';

type Exercise = {
  exercise_id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  is_custom: boolean;
};

const MUSCLE_FILTERS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('Chest');
  const [newEquipment, setNewEquipment] = useState('Barbell');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/exercises');
      setExercises(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'All' || e.muscle_group === filter;
      return matchesSearch && matchesFilter;
    });
  }, [exercises, search, filter]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Missing name', 'Please enter an exercise name.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/exercises', {
        name: newName.trim(),
        muscle_group: newMuscle,
        equipment: newEquipment,
      });
      setNewName('');
      setModalOpen(false);
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not create exercise');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>LIBRARY</Text>
          <Text style={styles.title}>EXERCISES</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalOpen(true)}
          testID="add-exercise-btn"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises"
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          testID="exercise-search-input"
        />
      </View>

      <View style={styles.filters}>
        <FlatList
          data={MUSCLE_FILTERS}
          keyExtractor={(i) => i}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, filter === item && styles.chipActive]}
              onPress={() => setFilter(item)}
              testID={`filter-${item}`}
            >
              <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
                {item.toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.exercise_id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No exercises match your search.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.exerciseCard} testID={`exercise-${item.exercise_id}`}>
              <View style={styles.exIconWrap}>
                <Ionicons name="barbell" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{item.name}</Text>
                <Text style={styles.exMeta}>
                  {item.muscle_group} · {item.equipment}
                  {item.is_custom ? ' · CUSTOM' : ''}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}
        >
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setModalOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>NEW EXERCISE</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cable Fly"
              placeholderTextColor={colors.textDisabled}
              value={newName}
              onChangeText={setNewName}
              testID="new-exercise-name"
            />

            <Text style={styles.label}>Muscle Group</Text>
            <View style={styles.pillRow}>
              {MUSCLE_FILTERS.filter((m) => m !== 'All').map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pill, newMuscle === m && styles.pillActive]}
                  onPress={() => setNewMuscle(m)}
                >
                  <Text style={[styles.pillText, newMuscle === m && styles.pillTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Equipment</Text>
            <View style={styles.pillRow}>
              {['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Other'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pill, newEquipment === m && styles.pillActive]}
                  onPress={() => setNewEquipment(m)}
                >
                  <Text style={[styles.pillText, newEquipment === m && styles.pillTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleCreate}
              disabled={saving}
              testID="save-exercise-btn"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>ADD EXERCISE</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  eyebrow: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 34, letterSpacing: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  filters: { marginTop: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textSecondary, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1 },
  chipTextActive: { color: '#fff' },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontFamily: fonts.body,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  exIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exName: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 15 },
  exMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDisabled,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 22,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.body,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.textSecondary, fontFamily: fonts.bodyMedium, fontSize: 12 },
  pillTextActive: { color: '#fff' },
  saveBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontFamily: fonts.bodyBold, letterSpacing: 2 },
});
