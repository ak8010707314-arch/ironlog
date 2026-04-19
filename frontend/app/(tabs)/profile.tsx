import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { colors, spacing, radii, fonts } from '../../src/theme';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Log out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const initials = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: spacing.md }}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>PROFILE</Text>

        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.name} testID="profile-name">{user?.name}</Text>
          <Text style={styles.email} testID="profile-email">{user?.email}</Text>
          <View style={styles.providerBadge}>
            <Ionicons
              name={user?.auth_provider === 'google' ? 'logo-google' : 'mail-outline'}
              size={12}
              color={colors.textSecondary}
            />
            <Text style={styles.providerText}>
              {user?.auth_provider === 'google' ? 'GOOGLE' : 'EMAIL'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} testID="logout-btn">
          <Ionicons name="log-out-outline" size={18} color={colors.brand} />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>IRONLOG</Text>
          <Text style={styles.footerText}>Track. Overload. Progress.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  eyebrow: { color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 34, letterSpacing: 2, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, padding: spacing.lg, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: radii.pill, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fonts.heading, fontSize: 34 },
  name: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 24, letterSpacing: 1.5, marginTop: spacing.md },
  email: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  providerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md, backgroundColor: colors.inputBg, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  providerText: { color: colors.textSecondary, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: radii.lg, paddingVertical: 14, marginTop: spacing.lg },
  logoutText: { color: colors.brand, fontFamily: fonts.bodyBold, letterSpacing: 2 },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
  footerBrand: { color: colors.textDisabled, fontFamily: fonts.heading, fontSize: 24, letterSpacing: 3 },
  footerText: { color: colors.textDisabled, fontFamily: fonts.body, fontSize: 11, letterSpacing: 1 },
});
