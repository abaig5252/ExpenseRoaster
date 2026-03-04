import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet, apiPost, apiDelete, API_BASE_URL, getToken } from '../../src/lib/api';
import { colors, spacing, radius, typography } from '../../src/theme';

interface Expense {
  id: number;
  description: string;
  amountCents: number;
  category: string;
  roast: string | null;
  currency: string;
  source: string;
}

const CATEGORIES = ['Food & Drink', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Subscriptions', 'Other'];
const TONES = [
  { value: 'savage', label: '🔥 Savage' },
  { value: 'playful', label: '😄 Playful' },
  { value: 'supportive', label: '💛 Supportive' },
];

const EMPTY = { description: '', amount: '', category: 'Other' };

export default function BankScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isPremium = user?.tier === 'premium';

  const [tab, setTab] = useState<'manual' | 'import'>('manual');
  const [form, setForm] = useState(EMPTY);
  const [tone, setTone] = useState('savage');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importImageUri, setImportImageUri] = useState<string | null>(null);
  const [parsedRoast, setParsedRoast] = useState<string | null>(null);

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () => apiGet('/api/expenses'),
    enabled: isPremium,
  });

  const manualExpenses = expenses?.filter(e => e.source === 'manual' || e.source === 'bank_statement') ?? [];

  async function submitManual() {
    if (!form.description.trim() || !form.amount) {
      Alert.alert('Missing fields', 'Please fill in description and amount.'); return;
    }
    const amountCents = Math.round(parseFloat(form.amount) * 100);
    if (isNaN(amountCents)) { Alert.alert('Invalid amount'); return; }
    setSubmittingManual(true);
    try {
      await apiPost('/api/expenses/manual', {
        description: form.description.trim(),
        amountCents,
        category: form.category,
        tone,
      });
      qc.invalidateQueries({ queryKey: ['/api/expenses'] });
      setForm(EMPTY);
      Alert.alert('Added!', 'Expense added and roasted.');
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmittingManual(false);
    }
  }

  async function pickStatementImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission denied', 'Photo library access needed.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      setImportImageUri(res.assets[0].uri);
      setParsedRoast(null);
    }
  }

  async function importStatement() {
    if (!importImageUri || importing) return;
    setImporting(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('statement', { uri: importImageUri, type: 'image/jpeg', name: 'statement.jpg' } as never);
      fd.append('tone', tone);

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/expenses/parse-statement`, {
        method: 'POST', headers, body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Parse failed' }));
        throw new Error((err as { message?: string }).message);
      }
      const data = await res.json() as { roast?: string };
      setParsedRoast(data.roast || 'Statement processed!');
      qc.invalidateQueries({ queryKey: ['/api/expenses'] });
    } catch (e: unknown) {
      Alert.alert('Import Failed', (e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function deleteExpense(id: number) {
    try {
      await apiDelete(`/api/expenses/${id}`);
      qc.invalidateQueries({ queryKey: ['/api/expenses'] });
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  if (!isPremium) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.locked}>
          <Ionicons name="lock-closed" size={48} color={colors.primary} />
          <Text style={s.lockedTitle}>Premium Feature</Text>
          <Text style={s.lockedSub}>
            Upgrade to Premium to add manual expenses, import bank statements, and track your spending.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Bank & Expenses</Text>

        <View style={s.tabRow}>
          {(['manual', 'import'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'manual' ? 'Manual Entry' : 'Import Statement'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'manual' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Add Expense</Text>

            <View style={s.field}>
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Starbucks Coffee"
                placeholderTextColor={colors.textMuted}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
              />
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>Amount ({user?.currency ?? 'USD'})</Text>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={v => setForm(f => ({ ...f, amount: v }))}
              />
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[s.catChip, form.category === c && s.catChipActive]}
                    onPress={() => setForm(f => ({ ...f, category: c }))}
                  >
                    <Text style={[s.catText, form.category === c && s.catTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={s.toneRow}>
              {TONES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[s.toneChip, tone === t.value && s.toneChipActive]}
                  onPress={() => setTone(t.value)}
                >
                  <Text style={[s.toneText, tone === t.value && s.toneTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={submitManual} disabled={submittingManual} activeOpacity={0.85}>
              {submittingManual ? <ActivityIndicator color="#0D0D0D" /> : (
                <Text style={s.submitBtnText}>Add & Roast</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {tab === 'import' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Import Bank Statement</Text>
            <Text style={s.cardSub}>Take a photo or screenshot of your bank statement</Text>

            <TouchableOpacity style={s.importZone} onPress={pickStatementImage} activeOpacity={0.8}>
              {importImageUri ? (
                <Image source={{ uri: importImageUri }} style={s.importPreview} resizeMode="cover" />
              ) : (
                <View style={s.importPlaceholder}>
                  <Ionicons name="document-text-outline" size={36} color={colors.textDim} />
                  <Text style={s.importPlaceholderText}>Tap to select image</Text>
                </View>
              )}
            </TouchableOpacity>

            {importImageUri && (
              <TouchableOpacity style={s.submitBtn} onPress={importStatement} disabled={importing} activeOpacity={0.85}>
                {importing ? <ActivityIndicator color="#0D0D0D" /> : (
                  <Text style={s.submitBtnText}>Import & Roast</Text>
                )}
              </TouchableOpacity>
            )}

            {parsedRoast && (
              <View style={s.roastResult}>
                <Text style={s.roastLabel}>THE ROAST</Text>
                <Text style={s.roastText}>"{parsedRoast}"</Text>
              </View>
            )}
          </View>
        )}

        {manualExpenses.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>Your Expenses ({manualExpenses.length})</Text>
            {manualExpenses.map(exp => (
              <View key={exp.id} style={s.expItem}>
                <View style={s.expTop}>
                  <Text style={s.expDesc} numberOfLines={1}>{exp.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={s.expAmount}>{(exp.amountCents / 100).toFixed(2)} {exp.currency}</Text>
                    <TouchableOpacity onPress={() => deleteExpense(exp.id)}>
                      <Ionicons name="trash-outline" size={16} color={colors.textDim} />
                    </TouchableOpacity>
                  </View>
                </View>
                {exp.roast && <Text style={s.expRoast} numberOfLines={2}>"{exp.roast}"</Text>}
                <Text style={s.expCat}>{exp.category}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  lockedTitle: { ...typography.h2 },
  lockedSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  pageTitle: { ...typography.h2, marginBottom: spacing.xs },
  tabRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md },
  tabBtnActive: { backgroundColor: colors.primaryDim },
  tabText: { ...typography.caption, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    gap: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { ...typography.h3 },
  cardSub: { ...typography.bodyMuted },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label },
  input: {
    backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 15,
  },
  catScroll: { marginHorizontal: -spacing.xs },
  catChip: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderRadius: radius.full, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.xs,
  },
  catChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  catText: { ...typography.caption },
  catTextActive: { color: colors.primary },
  toneRow: { flexDirection: 'row', gap: spacing.sm },
  toneChip: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  toneChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  toneText: { ...typography.caption },
  toneTextActive: { color: colors.primary, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.md,
    borderRadius: radius.lg, alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },
  importZone: {
    height: 160, backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  importPreview: { width: '100%', height: '100%' },
  importPlaceholder: { alignItems: 'center', gap: spacing.sm },
  importPlaceholderText: { ...typography.bodyMuted },
  roastResult: {
    backgroundColor: colors.primaryDim, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: 'rgba(124,255,77,0.2)',
  },
  roastLabel: { ...typography.label, color: colors.primary },
  roastText: { ...typography.body, fontStyle: 'italic' },
  historySection: { gap: spacing.sm },
  historyTitle: { ...typography.h3 },
  expItem: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  expTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expDesc: { ...typography.body, flex: 1, marginRight: spacing.sm },
  expAmount: { ...typography.body, fontWeight: '700', color: colors.primary },
  expRoast: { ...typography.bodyMuted, fontStyle: 'italic' },
  expCat: { ...typography.caption },
});
