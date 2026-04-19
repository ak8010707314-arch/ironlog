import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/auth';
import { colors, fonts } from '../src/theme';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const { loginWithGoogleSession } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        let sessionId = params.session_id as string | undefined;
        if (!sessionId && typeof window !== 'undefined' && window.location?.hash) {
          const hash = window.location.hash.substring(1);
          const p = new URLSearchParams(hash);
          sessionId = p.get('session_id') || undefined;
        }
        if (!sessionId) {
          router.replace('/login');
          return;
        }
        await loginWithGoogleSession(sessionId);
        router.replace('/(tabs)');
      } catch {
        router.replace('/login');
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 16, color: colors.textSecondary, fontFamily: fonts.body },
});
