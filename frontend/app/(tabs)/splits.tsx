import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { colors, spacing, radii, fonts } from '../../src/theme';

type Split = {
  split_id: string;
  name: string;
  days: { day_id: string; name: string; exercise_ids: string[] }[];
  created_at: string;
};

export default function SplitsScreen() {
  const router = useRouter();
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/splits');
      setSplits(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = (id: string) => {
    Alert.alert('Delete split?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.delete(`/splits/${id}`);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR SPLITS</Text>
          <Text style={styles.title}>WORKOUTS</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/split/create')}
          testID="create-split-btn"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : splits.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>NO SPLITS YET</Text>
          <Text style={styles.emptySub}>
            Create a training split (e.g. Push/Pull/Legs) to organize your workouts.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/split/create')}
            testID="empty-create-split-btn"
          >
            <Text style={styles.primaryBtnText}>CREATE SPLIT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={splits}
          keyExtractor={(item) => item.split_id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <View style={styles.splitCard} testID={`split-${item.split_id}`}>
              <View style={styles.splitHeader}>
                <Text style={styles.splitName}>{item.name.toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => router.push(`/split/${item.split_id}`)}
                    testID={`edit-split-${item.split_id}`}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.split_id)}
                    testID={`delete-split-${item.split_id}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.splitSub}>{item.days.length} days</Text>
              <View style={styles.daysList}>
                {item.days.map((d) => (
                  <TouchableOpacity
                    key={d.day_id}
                    style={styles.dayRow}
                    onPress={() =>
                      router.push({
                        pathname: '/workout/active',
                        params: {
                          split_id: item.split_id,
                          day_id: d.day_id,
                          day_name: d.name,
                          exercise_ids: d.exercise_ids.join(','),
                        },
                      })
                    }
                    testID={`start-day-${d.day_id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayName}>{d.name.toUpperCase()}</Text>
                      <Text style={styles.dayMeta}>{d.exercise_ids.length} exercises</Text>
                    </View>
                    <View style={styles.playBtn}>
                      <Ionicons name="play" size={14} color="#fff" />
                      <Text style={styles.playText}>START</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 2 },
  emptySub: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.lg,
    marginTop: spacing.md,
  },
  primaryBtnText: { color: '#fff', fontFamily: fonts.bodyBold, letterSpacing: 2 },
  splitCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  splitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  splitName: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1.5 },
  splitSub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  daysList: { marginTop: spacing.md, gap: spacing.sm },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  dayName: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 1 },
  dayMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  playText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
});
