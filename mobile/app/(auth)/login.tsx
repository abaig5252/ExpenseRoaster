import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/auth';
import { API_BASE_URL } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors } from '../../src/theme';

type ViewType = 'login' | 'register' | 'forgot' | 'forgot-sent';

const GREEN       = colors.primary;
const GREEN_FOCUS = colors.primaryBorder;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [view, setView]                     = useState<ViewType>('login');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName]           = useState('');
  const [showPass, setShowPass]             = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [focused, setFocused]               = useState<string | null>(null);

  function reset() { setError(null); }

  const inp = (name: string) => [s.input, focused === name && s.inputFocused];

  async function handleLogin() {
    reset();
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/mobile/login`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-auth-email': email, 'x-auth-password': password },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Login failed'); return; }
      await signIn(data.token);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleRegister() {
    reset();
    if (!firstName)                       { setError('First name is required'); return; }
    if (!email)                           { setError('Email is required'); return; }
    if (password.length < 8)              { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword)     { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/mobile/register`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-auth-email': email, 'x-auth-password': password, 'x-auth-firstname': firstName },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Registration failed'); return; }
      await signIn(data.token);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleForgot() {
    reset();
    if (!email) { setError('Email is required'); return; }
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/mobile/forgot-password`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-auth-email': email },
      });
      setView('forgot-sent');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  const isRegister = view === 'register';

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={s.screen}>

          {/* ── Logo area ── */}
          <View style={s.logoSection}>
            <AppLogo size="sm" />
            <Text style={s.logoName}>EXPENSE ROASTER</Text>
          </View>

          {/* ── Bottom card ── */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            scrollEnabled={isRegister}
          >
            <View style={s.card}>

              {/* ── Sign In ── */}
              {view === 'login' && (
                <>
                  <Text style={s.cardTitle}>Sign In</Text>
                  <Text style={s.cardSub}>Enter your details to continue</Text>

                  <TextInput
                    style={inp('email')}
                    placeholder="Email"
                    placeholderTextColor="#555"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />

                  <View style={[s.inputRow, focused === 'password' && s.inputFocused]}>
                    <TextInput
                      style={s.inputFlex}
                      placeholder="Password"
                      placeholderTextColor="#555"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {error ? <Text style={s.error}>{error}</Text> : null}

                  <TouchableOpacity onPress={() => { reset(); setView('forgot'); }}>
                    <Text style={s.forgotLink}>Forgot password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.btnWrap, loading && s.btnDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#00E676', '#6BFF9C']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={s.btn}
                    >
                      {loading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.btnText}>Sign In</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={s.dividerRow}>
                    <View style={s.dividerLine} />
                    <Text style={s.dividerText}>or continue with</Text>
                    <View style={s.dividerLine} />
                  </View>

                  <View style={s.socialRow}>
                    <TouchableOpacity style={s.socialBtn} activeOpacity={0.7}>
                      <Ionicons name="logo-google" size={19} color="#fff" />
                      <Text style={s.socialBtnText}>Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.socialBtn} activeOpacity={0.7}>
                      <Ionicons name="logo-apple" size={19} color="#fff" />
                      <Text style={s.socialBtnText}>Apple</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.switchRow}>
                    <Text style={s.switchText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => { reset(); setView('register'); }}>
                      <Text style={s.switchLink}>Create one</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Register ── */}
              {view === 'register' && (
                <>
                  <Text style={s.cardTitle}>Create Account</Text>
                  <Text style={s.cardSub}>Fill in your details to get started</Text>

                  <TextInput
                    style={inp('firstName')}
                    placeholder="First Name"
                    placeholderTextColor="#555"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    onFocus={() => setFocused('firstName')}
                    onBlur={() => setFocused(null)}
                  />

                  <TextInput
                    style={inp('email')}
                    placeholder="Email"
                    placeholderTextColor="#555"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />

                  <View style={[s.inputRow, focused === 'password' && s.inputFocused]}>
                    <TextInput
                      style={s.inputFlex}
                      placeholder="Password (min 8 chars)"
                      placeholderTextColor="#555"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={[s.inputRow, focused === 'confirm' && s.inputFocused]}>
                    <TextInput
                      style={s.inputFlex}
                      placeholder="Confirm Password"
                      placeholderTextColor="#555"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirm}
                      onFocus={() => setFocused('confirm')}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {error ? <Text style={s.error}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[s.btnWrap, loading && s.btnDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#00E676', '#6BFF9C']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={s.btn}
                    >
                      {loading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.btnText}>Create Account</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={s.dividerRow}>
                    <View style={s.dividerLine} />
                    <Text style={s.dividerText}>or continue with</Text>
                    <View style={s.dividerLine} />
                  </View>

                  <View style={s.socialRow}>
                    <TouchableOpacity style={s.socialBtn} activeOpacity={0.7}>
                      <Ionicons name="logo-google" size={19} color="#fff" />
                      <Text style={s.socialBtnText}>Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.socialBtn} activeOpacity={0.7}>
                      <Ionicons name="logo-apple" size={19} color="#fff" />
                      <Text style={s.socialBtnText}>Apple</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.switchRow}>
                    <Text style={s.switchText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => { reset(); setView('login'); }}>
                      <Text style={s.switchLink}>Sign in</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Forgot password ── */}
              {view === 'forgot' && (
                <>
                  <TouchableOpacity onPress={() => { reset(); setView('login'); }} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={16} color="#666" />
                    <Text style={s.backText}>Back to sign in</Text>
                  </TouchableOpacity>

                  <Text style={s.cardTitle}>Reset Password</Text>
                  <Text style={s.cardSub}>Enter your email and we'll send a reset link.</Text>

                  <TextInput
                    style={inp('email')}
                    placeholder="Email"
                    placeholderTextColor="#555"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />

                  {error ? <Text style={s.error}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[s.btnWrap, loading && s.btnDisabled]}
                    onPress={handleForgot}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#00E676', '#6BFF9C']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={s.btn}
                    >
                      {loading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.btnText}>Send Reset Link</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Forgot sent ── */}
              {view === 'forgot-sent' && (
                <View style={s.sentWrap}>
                  <Ionicons name="checkmark-circle" size={56} color={GREEN} />
                  <Text style={s.cardTitle}>Check Your Email</Text>
                  <Text style={[s.cardSub, { textAlign: 'center' }]}>
                    If an account with that email exists, we've sent a reset link. It expires in 1 hour.
                  </Text>
                  <TouchableOpacity onPress={() => { reset(); setView('login'); }}>
                    <Text style={s.switchLink}>Back to sign in</Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          </ScrollView>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  screen: { flex: 1 },

  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  logoName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#2a2a2a',
    paddingTop: 32,
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 14,
  },
  cardTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  cardSub:   { fontSize: 14, color: '#888', marginTop: -4 },

  input: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    color: '#F0F0F0',
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingLeft: 18,
    paddingRight: 12,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 16,
    color: '#F0F0F0',
    fontSize: 15,
  },
  inputFocused: {
    borderColor: GREEN_FOCUS,
    shadowColor: GREEN,
    shadowRadius: 4,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 0 },
  },
  eyeBtn: {
    padding: 6,
  },

  error:      { color: '#FF5252', fontSize: 13, textAlign: 'center' },
  forgotLink: { color: GREEN, fontSize: 13, textAlign: 'right', marginTop: -4 },

  btnWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: GREEN,
    shadowRadius: 14,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  btn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2a2a2a' },
  dividerText: { fontSize: 13, color: '#555' },

  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f1f1f',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingVertical: 14,
  },
  socialBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  switchRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  switchText: { fontSize: 14, color: '#666' },
  switchLink: { color: GREEN, fontSize: 14, fontWeight: '600' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  backText: { fontSize: 13, color: '#666' },

  sentWrap: { alignItems: 'center', gap: 16, paddingVertical: 24 },
});
