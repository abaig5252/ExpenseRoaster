import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/auth';
import { API_BASE_URL } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../../src/theme';

type View = 'login' | 'register' | 'forgot' | 'forgot-sent';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() { setError(null); }

  async function handleLogin() {
    reset();
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/local/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Login failed'); return; }
      await signIn(data.token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    reset();
    if (!firstName) { setError('First name is required'); return; }
    if (!email) { setError('Email is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/local/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Registration failed'); return; }
      await signIn(data.token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    reset();
    if (!email) { setError('Email is required'); return; }
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/local/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setView('forgot-sent');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logoWrap}>
            <AppLogo size="lg" />
          </View>

          <View style={s.card}>
            {view === 'login' && (
              <>
                <Text style={s.title}>Sign in</Text>
                <Text style={s.subtitle}>Enter your email and password to continue.</Text>

                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor={colors.textDim}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Password"
                    placeholderTextColor={colors.textDim}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textDim} />
                  </TouchableOpacity>
                </View>

                {error && <Text style={s.error}>{error}</Text>}

                <TouchableOpacity onPress={() => { reset(); setView('forgot'); }}>
                  <Text style={s.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator size="small" color="#0D0D0D" /> : <Text style={s.btnText}>Sign In</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { reset(); setView('register'); }}>
                  <Text style={s.switchText}>Don't have an account? <Text style={s.switchLink}>Create one</Text></Text>
                </TouchableOpacity>
              </>
            )}

            {view === 'register' && (
              <>
                <Text style={s.title}>Create account</Text>
                <Text style={s.subtitle}>Join Expense Roaster and face your financial reality.</Text>

                <TextInput
                  style={s.input}
                  placeholder="First name"
                  placeholderTextColor={colors.textDim}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor={colors.textDim}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Password (min 8 chars)"
                    placeholderTextColor={colors.textDim}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textDim} />
                  </TouchableOpacity>
                </View>

                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Confirm password"
                    placeholderTextColor={colors.textDim}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textDim} />
                  </TouchableOpacity>
                </View>

                {error && <Text style={s.error}>{error}</Text>}

                <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator size="small" color="#0D0D0D" /> : <Text style={s.btnText}>Create Account</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { reset(); setView('login'); }}>
                  <Text style={s.switchText}>Already have an account? <Text style={s.switchLink}>Sign in</Text></Text>
                </TouchableOpacity>
              </>
            )}

            {view === 'forgot' && (
              <>
                <TouchableOpacity onPress={() => { reset(); setView('login'); }} style={s.backBtn}>
                  <Ionicons name="arrow-back" size={16} color={colors.textDim} />
                  <Text style={s.backText}>Back to sign in</Text>
                </TouchableOpacity>

                <Text style={s.title}>Reset password</Text>
                <Text style={s.subtitle}>Enter your email and we'll send a reset link.</Text>

                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor={colors.textDim}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {error && <Text style={s.error}>{error}</Text>}

                <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleForgot} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator size="small" color="#0D0D0D" /> : <Text style={s.btnText}>Send Reset Link</Text>}
                </TouchableOpacity>
              </>
            )}

            {view === 'forgot-sent' && (
              <View style={s.sentWrap}>
                <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
                <Text style={s.title}>Check your email</Text>
                <Text style={[s.subtitle, { textAlign: 'center' }]}>
                  If an account with that email exists, we've sent a reset link. It expires in 1 hour.
                </Text>
                <TouchableOpacity onPress={() => { reset(); setView('login'); }}>
                  <Text style={s.switchLink}>Back to sign in</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg, gap: spacing.xl, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.bodyMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: 15,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: { padding: spacing.sm },
  error: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  forgotLink: { color: colors.primary, fontSize: 13, textAlign: 'right', marginTop: -spacing.xs },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
  switchText: { ...typography.caption, textAlign: 'center', color: colors.textMuted },
  switchLink: { color: colors.primary, fontWeight: '600' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  backText: { ...typography.caption, color: colors.textDim },
  sentWrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
});
