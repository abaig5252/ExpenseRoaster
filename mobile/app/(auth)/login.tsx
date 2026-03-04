import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/auth';
import { API_BASE_URL } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../../src/theme';

export default function LoginScreen() {
  const [showWebView, setShowWebView] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const { signIn } = useAuth();
  const router = useRouter();

  const LOGIN_URL = `${API_BASE_URL}/api/login`;

  const INJECT_JS = `
    (function() {
      var path = window.location.pathname;
      var isApp = path === '/upload' || path === '/dashboard' ||
                  path === '/onboarding' || path === '/';
      var isExternal = window.location.hostname !== '${new URL(API_BASE_URL.startsWith('http') ? API_BASE_URL : 'https://' + API_BASE_URL).hostname}';
      if (isApp && !isExternal && !window.__mobileTokenFetched) {
        window.__mobileTokenFetched = true;
        fetch('/api/mobile/token', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.token) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTH_TOKEN', token: d.token }));
          }
        })
        .catch(function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTH_ERROR', error: String(e) }));
        });
      }
      true;
    })();
  `;

  async function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'AUTH_TOKEN' && msg.token) {
        setSigningIn(true);
        await signIn(msg.token);
        router.replace('/(tabs)/upload');
      }
    } catch {
      /* ignore parse errors */
    }
  }

  if (showWebView) {
    return (
      <View style={styles.webViewWrap}>
        {webViewLoading && (
          <View style={styles.webViewLoader}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        {signingIn && (
          <View style={styles.signingInOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.body, { marginTop: spacing.md }]}>Signing in…</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: LOGIN_URL }}
          onLoadStart={() => setWebViewLoading(true)}
          onLoadEnd={() => setWebViewLoading(false)}
          onMessage={handleMessage}
          injectedJavaScript={INJECT_JS}
          javaScriptEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          style={styles.webView}
          onNavigationStateChange={(state) => {
            if (
              state.url.startsWith(API_BASE_URL) &&
              !state.url.includes('/api/') &&
              !state.loading
            ) {
              webViewRef.current?.injectJavaScript(INJECT_JS);
            }
          }}
        />
        <SafeAreaView style={styles.webViewFooter}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowWebView(false)}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
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

        <TouchableOpacity style={styles.signInBtn} onPress={() => setShowWebView(true)} activeOpacity={0.85}>
          <Text style={styles.signInText}>Sign In to Get Roasted</Text>
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
  signInBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  signInText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
  terms: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  webViewWrap: { flex: 1, backgroundColor: '#fff' },
  webViewLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  signingInOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  webView: { flex: 1 },
  webViewFooter: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelText: { ...typography.bodyMuted },
});
