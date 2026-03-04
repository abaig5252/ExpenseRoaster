import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/lib/auth';
import { apiPost } from '../src/lib/api';
import { AppLogo } from '../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../src/theme';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'SGD', 'AED', 'CHF'];

export default function OnboardingScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [currency, setCurrency] = useState(user?.currency ?? 'USD');
  const [saving, setSaving] = useState(false);

  async function complete() {
    setSaving(true);
    try {
      await apiPost('/api/me/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        currency,
        onboardingComplete: true,
      });
      await refreshUser();
      router.replace('/(tabs)/upload');
    } catch (e: unknown) {
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "Welcome to Expense Roaster",
      subtitle: "We're about to judge your financial decisions — mercilessly.",
      content: (
        <View style={s.stepContent}>
          <AppLogo size="md" />
          <View style={s.features}>
            {[
              { icon: 'flame', text: 'Upload receipts for instant AI roasts' },
              { icon: 'bar-chart', text: 'Track monthly spending patterns' },
              { icon: 'document-text', text: 'Import and analyze bank statements' },
              { icon: 'trophy', text: 'Annual spending shame report' },
            ].map(({ icon, text }) => (
              <View key={text} style={s.feature}>
                <View style={s.featureIcon}>
                  <Ionicons name={icon as never} size={16} color={colors.primary} />
                </View>
                <Text style={s.featureText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      title: "What should we call you?",
      subtitle: "So we can personalize your roasts.",
      content: (
        <View style={s.stepContent}>
          <View style={s.field}>
            <Text style={s.fieldLabel}>First Name</Text>
            <TextInput
              style={s.input}
              placeholder="Enter first name"
              placeholderTextColor={colors.textMuted}
              value={firstName}
              onChangeText={setFirstName}
              autoFocus
            />
          </View>
          <View style={s.field}>
            <Text style={s.fieldLabel}>Last Name</Text>
            <TextInput
              style={s.input}
              placeholder="Enter last name"
              placeholderTextColor={colors.textMuted}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        </View>
      ),
    },
    {
      title: "Pick your currency",
      subtitle: "We'll use this in your roasts and expense tracking.",
      content: (
        <View style={s.currencyGrid}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[s.currencyChip, currency === c && s.currencyChipActive]}
              onPress={() => setCurrency(c)}
            >
              <Text style={[s.currencyText, currency === c && s.currencyTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
    },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <SafeAreaView style={s.root}>
      <View style={s.progressRow}>
        {steps.map((_, i) => (
          <View key={i} style={[s.dot, i <= step && s.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{current.title}</Text>
        <Text style={s.subtitle}>{current.subtitle}</Text>
        {current.content}
      </ScrollView>

      <View style={s.footer}>
        {step > 0 && (
          <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.nextBtn, step === 0 && s.nextBtnFull]}
          onPress={isLast ? complete : () => setStep(s => s + 1)}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Text style={s.nextText}>{isLast ? "Let's Go 🔥" : "Next"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  progressRow: {
    flexDirection: 'row', gap: spacing.xs,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  dot: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: colors.surface,
  },
  dotActive: { backgroundColor: colors.primary },
  scroll: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  title: { ...typography.h1 },
  subtitle: { ...typography.bodyMuted },
  stepContent: { gap: spacing.lg, paddingTop: spacing.md },
  features: { gap: spacing.md },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(124,255,77,0.15)',
  },
  featureText: { ...typography.body, flex: 1 },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: 16,
  },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm },
  currencyChip: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    minWidth: 70, alignItems: 'center',
  },
  currencyChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  currencyText: { ...typography.body, fontWeight: '600', color: colors.textMuted },
  currencyTextActive: { color: colors.primary },
  footer: {
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.lg, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  backBtn: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { ...typography.body, color: colors.textMuted },
  nextBtn: {
    flex: 1, backgroundColor: colors.primary,
    paddingVertical: spacing.md, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnFull: { flex: 1 },
  nextText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
});
