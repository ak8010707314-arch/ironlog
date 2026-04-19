import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth';
import { colors, spacing, radii, fonts } from '../src/theme';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1770513649465-2c60c8039806?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxkYXJrJTIwZ3ltJTIwYXRtb3NwaGVyaWN8ZW58MHx8fHwxNzc2NDAxMjY1fDA&ixlib=rb-4.1.0&q=85';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const { login, loginWithGoogleSession } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Login failed';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const base = process.env.EXPO_PUBLIC_BACKEND_URL as string;
      const redirectUrl = `${base}/auth-callback`;
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const hashIndex = result.url.indexOf('#');
        if (hashIndex === -1) throw new Error('No session id returned');
        const hash = result.url.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');
        if (!sessionId) throw new Error('No session id');
        await loginWithGoogleSession(sessionId);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Google sign-in failed', err?.message || 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.bg} testID="login-bg">
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.brand}>IRONLOG</Text>
            <Text style={styles.tagline}>Track. Overload. Progress.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.h1}>WELCOME BACK</Text>
            <Text style={styles.sub}>Sign in to continue your grind.</Text>

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
                testID="login-email-input"
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textDisabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="login-password-input"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              testID="login-submit-btn"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>SIGN IN</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogle}
              disabled={googleLoading}
              activeOpacity={0.85}
              testID="login-google-btn"
            >
              {googleLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Image
                    source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }}
                    style={styles.googleIcon}
                  />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => router.push('/signup')}
              testID="goto-signup-btn"
            >
              <Text style={styles.switchText}>
                New here? <Text style={styles.switchAccent}>Create account</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.78)' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  brand: {
    fontFamily: fonts.heading,
    fontSize: 52,
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
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
  h1: {
    fontFamily: fonts.heading,
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.lg,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 2,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 14,
  },
  googleIcon: { width: 18, height: 18 },
  googleText: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  switchBtn: { marginTop: spacing.lg, alignItems: 'center' },
  switchText: { color: colors.textSecondary, fontFamily: fonts.body },
  switchAccent: { color: colors.brand, fontFamily: fonts.bodyBold },
});
