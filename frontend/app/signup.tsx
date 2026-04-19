import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth';
import { colors, spacing, radii, fonts } from '../src/theme';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { register } = useAuth();

  const handleSignup = async () => {
    if (!email || !password || !name) {
      Alert.alert('Missing fields', 'Please fill all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Sign up failed';
      Alert.alert('Sign up failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="signup-back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.brand}>CREATE ACCOUNT</Text>
          <Text style={styles.tagline}>Join the IronLog squad</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.textDisabled}
              value={name}
              onChangeText={setName}
              testID="signup-name-input"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textDisabled}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              testID="signup-email-input"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Password (6+ chars)"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              testID="signup-password-input"
            />
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
            testID="signup-submit-btn"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>CREATE ACCOUNT</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => router.replace('/login')}
            testID="goto-login-btn"
          >
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xxl, justifyContent: 'center' },
  back: { position: 'absolute', top: spacing.xl, left: spacing.md, padding: spacing.sm, zIndex: 10 },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  brand: {
    fontFamily: fonts.heading,
    fontSize: 42,
    color: colors.textPrimary,
    letterSpacing: 3,
  },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    letterSpacing: 2,
  },
  switchBtn: { marginTop: spacing.lg, alignItems: 'center' },
  switchText: { color: colors.textSecondary, fontFamily: fonts.body },
  switchAccent: { color: colors.brand, fontFamily: fonts.bodyBold },
});
