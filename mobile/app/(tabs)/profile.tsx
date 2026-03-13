import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert, Linking, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/lib/auth';
import { apiPost, apiGet, API_BASE_URL } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../../src/theme';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'SGD', 'AED', 'CHF'];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [contactOpen, setContactOpen]   = useState(false);
  const [contactName, setContactName]   = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg]     = useState('');
  const [sending, setSending]           = useState(false);
  const [sent, setSent]                 = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  function openContact() {
    const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '';
    setContactName(displayName);
    setContactEmail(user?.email ?? '');
    setContactMsg('');
    setSent(false);
    setContactOpen(true);
  }

  function closeContact() {
    setContactOpen(false);
    setSent(false);
  }

  async function sendContact() {
    if (!contactName.trim()) { Alert.alert('Required', 'Please enter your name.'); return; }
    if (!contactEmail.trim()) { Alert.alert('Required', 'Please enter your email.'); return; }
    if (contactMsg.trim().length < 10) { Alert.alert('Too short', 'Please describe your issue (at least 10 characters).'); return; }
    setSending(true);
    try {
      await apiPost('/api/contact', { name: contactName.trim(), email: contactEmail.trim(), message: contactMsg.trim() });
      setSent(true);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function manageSubscription() {
    try {
      const data = await apiPost<{ url: string }>('/api/stripe/portal');
      if (data.url) await Linking.openURL(data.url);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function upgradeToPremiun() {
    try {
      const data = await apiGet<{ url: string }>('/api/stripe/checkout?plan=premium&mode=subscription');
      if (data.url) await Linking.openURL(data.url);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Expense Roastee';
  const tierLabel = user?.tier === 'premium' ? 'Premium' : 'Free';
  const tierColor = user?.tier === 'premium' ? colors.primary : colors.textMuted;

  const inp = (field: string) => [s.input, focusedField === field && s.inputFocused];

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.displayName}>{displayName}</Text>
          {user?.email && <Text style={s.email}>{user.email}</Text>}
          <View style={s.tierBadge}>
            <Ionicons name={user?.tier === 'premium' ? 'star' : 'star-outline'} size={13} color={tierColor} />
            <Text style={[s.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>{user?.monthlyUploadCount ?? 0}</Text>
            <Text style={s.statLabel}>This Month</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>{user?.currency ?? 'USD'}</Text>
            <Text style={s.statLabel}>Currency</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>{user?.hasAnnualReport ? '✓' : '—'}</Text>
            <Text style={s.statLabel}>Annual Report</Text>
          </View>
        </View>

        {user?.tier !== 'premium' && (
          <View style={s.upgradeCard}>
            <Ionicons name="star" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={s.upgradeSub}>Unlimited uploads, tracker, bank import • $9.99/mo</Text>
            </View>
            <TouchableOpacity style={s.upgradeBtn} onPress={upgradeToPremiun} activeOpacity={0.85}>
              <Text style={s.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>

          {user?.tier === 'premium' && (
            <TouchableOpacity style={s.menuItem} onPress={manageSubscription} activeOpacity={0.7}>
              <Ionicons name="card-outline" size={20} color={colors.textMuted} />
              <Text style={s.menuText}>Manage Subscription</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.menuItem} onPress={() => Linking.openURL(`${API_BASE_URL}/privacy`)} activeOpacity={0.7}>
            <Ionicons name="shield-outline" size={20} color={colors.textMuted} />
            <Text style={s.menuText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity style={s.menuItem} onPress={() => Linking.openURL(`${API_BASE_URL}/terms`)} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
            <Text style={s.menuText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity style={s.menuItem} onPress={openContact} activeOpacity={0.7}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <Text style={s.menuText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={confirmSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={s.logoFooter}>
          <AppLogo size="xs" />
          <Text style={s.version}>v1.0.0</Text>
        </View>
      </ScrollView>

      {/* ── Contact Support Modal ── */}
      <Modal
        visible={contactOpen}
        animationType="slide"
        transparent
        onRequestClose={closeContact}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOuter}
        >
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closeContact} />

          <View style={s.sheet}>
            {/* Handle bar */}
            <View style={s.sheetHandle} />

            {/* Header */}
            <View style={s.sheetHeader}>
              <View style={s.sheetIconWrap}>
                <Ionicons name="mail-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Contact Support</Text>
                <Text style={s.sheetSub}>We read every message and reply personally.</Text>
              </View>
              <TouchableOpacity onPress={closeContact} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {sent ? (
              /* ── Success state ── */
              <View style={s.sentWrap}>
                <View style={s.sentIconWrap}>
                  <Ionicons name="checkmark-circle" size={52} color={colors.primary} />
                </View>
                <Text style={s.sentTitle}>Message sent!</Text>
                <Text style={s.sentSub}>
                  We've received your message and will get back to you at {contactEmail} as soon as possible.
                </Text>
                <TouchableOpacity style={s.sentBackBtn} onPress={closeContact} activeOpacity={0.8}>
                  <Text style={s.sentBackText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Form ── */
              <ScrollView
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.formScroll}
              >
                <View style={s.infoBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
                  <Text style={s.infoText}>
                    Technical issues, billing questions, feature requests — all welcome.
                  </Text>
                </View>

                <Text style={s.fieldLabel}>Your Name</Text>
                <TextInput
                  style={inp('name')}
                  placeholder="e.g. Jamie Smith"
                  placeholderTextColor={colors.textDim}
                  value={contactName}
                  onChangeText={setContactName}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />

                <Text style={s.fieldLabel}>Email Address</Text>
                <TextInput
                  style={inp('email')}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textDim}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />

                <Text style={s.fieldLabel}>How can we help?</Text>
                <TextInput
                  style={[inp('message'), s.textarea]}
                  placeholder="Describe your issue or suggestion…"
                  placeholderTextColor={colors.textDim}
                  value={contactMsg}
                  onChangeText={setContactMsg}
                  multiline
                  textAlignVertical="top"
                  onFocus={() => setFocusedField('message')}
                  onBlur={() => setFocusedField(null)}
                />

                <TouchableOpacity
                  style={[s.sendBtnWrap, sending && { opacity: 0.6 }]}
                  onPress={sendContact}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#00E676', '#6BFF9C']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.sendBtn}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <>
                          <Ionicons name="send-outline" size={16} color="#000" />
                          <Text style={s.sendBtnText}>Send Message</Text>
                        </>}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={s.directEmail}>
                  Or email us at{' '}
                  <Text style={s.directEmailLink} onPress={() => Linking.openURL('mailto:admin@expenseroaster.com')}>
                    admin@expenseroaster.com
                  </Text>
                </Text>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },

  avatarSection: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary,
  },
  avatarText:  { fontSize: 32, fontWeight: '700', color: colors.primary },
  displayName: { ...typography.h2 },
  email:       { ...typography.bodyMuted },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  tierText: { ...typography.caption, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  stat:       { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue:  { ...typography.h3, color: colors.primary },
  statLabel:  { ...typography.caption },
  statDivider:{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  upgradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primaryDim, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  upgradeTitle:   { ...typography.body, fontWeight: '700', color: colors.primary },
  upgradeSub:     { ...typography.caption },
  upgradeBtn:     { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  upgradeBtnText: { fontSize: 13, fontWeight: '700', color: '#0D0D0D' },

  section:      { gap: spacing.xs },
  sectionTitle: { ...typography.label, marginBottom: spacing.xs },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  menuText: { ...typography.body, flex: 1 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,77,77,0.2)',
  },
  signOutText: { ...typography.body, color: colors.error, fontWeight: '600' },

  logoFooter: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  version:    { ...typography.caption },

  // ── Modal ──────────────────────────────────────────────────────────
  modalOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2a2a2a',
    paddingBottom: 40,
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sheetIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  sheetTitle: { ...typography.h3, color: colors.text },
  sheetSub:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  closeBtn:   { padding: 4 },

  formScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primaryDim, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.primaryBorder,
    marginBottom: spacing.xs,
  },
  infoText: { fontSize: 13, color: colors.text, flex: 1, lineHeight: 19 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: spacing.xs },

  input: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: colors.primaryBorder,
    shadowColor: colors.primary,
    shadowRadius: 4,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 0 },
  },
  textarea: {
    height: 110,
    paddingTop: 14,
  },

  sendBtnWrap: { borderRadius: 12, overflow: 'hidden', marginTop: spacing.sm },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 15,
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },

  directEmail:     { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: spacing.md },
  directEmailLink: { color: colors.primary },

  // ── Sent state ──
  sentWrap: {
    alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xl,
  },
  sentIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  sentTitle:   { ...typography.h2, textAlign: 'center' },
  sentSub:     { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  sentBackBtn: {
    marginTop: spacing.sm, backgroundColor: colors.primaryDim,
    borderRadius: radius.full, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  sentBackText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
