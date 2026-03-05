import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/auth';
import { API_BASE_URL } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../../src/theme';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const loginUrl = `${API_BASE_URL}/api/mobile/login`;
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, 'expenseroaster://');

      if (result.type === 'success') {
        const url = result.url;
        console.log('[login] redirect URL:', url.slice(0, 100));
        // Robust query param extraction — avoids Linking.parse edge cases
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        const errMatch = url.match(/[?&]error=([^&]+)/);
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        const err = errMatch ? decodeURIComponent(errMatch[1]) : null;

        console.log('[login] token present:', !!token, 'first20:', token?.slice(0, 20));

        if (token) {
          await signIn(token);
          router.replace('/(tabs)/upload');
        } else {
          // Show the full URL so we can diagnose parsing failures
          setError(err ?? `No token in redirect.\nURL: ${url.slice(0, 200)}`);
        }
      } else {
        // Capture the result type if it's not success (cancel/dismiss/locked)
        if ((result as any).type !== 'cancel' && (result as any).type !== 'dismiss') {
          setError(`Auth session ended: ${(result as any).type}`);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <AppLogo size="lg" />

        <View style={styles.textBlock}>
          <Text style={styles.headline}>Get roasted for{'\n'}your spending habits</Text>
          <Text style={styles.sub}>
            Upload receipts and bank statements to receive brutally honest AI commentary on your financial choices.
          </Text>
        </View>

        <View style={styles.featureList}>
          {[
            { icon: 'flame', text: 'AI receipt roasts in seconds' },
            { icon: 'bar-chart', text: 'Monthly spending tracker' },
            { icon: 'document-text', text: 'Bank statement analysis' },
            { icon: 'trophy', text: 'Annual spending report' },
          ].map(({ icon, text }) => (
            <View key={text} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name={icon as never} size={16} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#ff6b6b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.signInBtn, loading && styles.signInBtnDisabled]}
          onPress={handleSignIn}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#0D0D0D" />
          ) : (
            <Text style={styles.signInText}>Sign In to Get Roasted</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.terms}>
          By signing in you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  textBlock: { alignItems: 'center', gap: spacing.sm },
  headline: {
    ...typography.h1,
    textAlign: 'center',
    color: colors.text,
  },
  sub: {
    ...typography.bodyMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  featureList: { width: '100%', gap: spacing.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,255,77,0.15)',
  },
  featureText: { ...typography.body, flex: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  errorText: {
    ...typography.caption,
    color: '#ff6b6b',
    flex: 1,
  },
  signInBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  signInBtnDisabled: { opacity: 0.6 },
  signInText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
  terms: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
