import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, TextInput, Platform,
  ActionSheetIOS, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet, apiPost, apiDelete, API_BASE_URL, getToken } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { colors, spacing, radius, typography } from '../../src/theme';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  roast: string | null;
  currency: string;
  source: string;
  date?: string;
  createdAt?: string;
}

const CATEGORIES = ['Food & Drink', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Subscriptions', 'Other'];
const TONES = [
  { value: 'savage',     label: 'Savage 🔥' },
  { value: 'playful',    label: 'Playful 😄' },
  { value: 'supportive', label: 'Supportive 💛' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$',
  JPY: '¥', CHF: 'Fr', INR: '₹', SGD: 'S$', MXN: '$',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(cents: number, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym}${(cents / 100).toFixed(2)}`;
}

const PAGE_SIZE = 10;

export default function BankScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isPremium = user?.tier === 'premium';
  const currency = user?.currency ?? 'USD';
  const currSym = CURRENCY_SYMBOLS[currency] ?? currency;

  const [tab, setTab] = useState<'manual' | 'import'>('manual');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState(todayStr());
  const [tone, setTone] = useState('savage');
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importImageUri, setImportImageUri] = useState<string | null>(null);
  const [parsedRoast, setParsedRoast] = useState<string | null>(null);
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () => apiGet('/api/expenses'),
    enabled: isPremium,
  });

  const loggedExpenses = expenses?.filter(e => e.source === 'manual' || e.source === 'bank_statement') ?? [];
  const totalPages = Math.ceil(loggedExpenses.length / PAGE_SIZE);
  const pageExpenses = loggedExpenses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function submitManual() {
    if (!description.trim() || !amount) {
      Alert.alert('Missing fields', 'Please fill in description and amount.'); return;
    }
    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInCents)) { Alert.alert('Invalid amount'); return; }
    setSubmitting(true);
    try {
      await apiPost('/api/expenses/manual', {
        description: description.trim(),
        amount: amountInCents,
        category,
        tone,
        date,
      });
      qc.invalidateQueries({ queryKey: ['/api/expenses'] });
      setDescription(''); setAmount(''); setCategory('Other'); setDate(todayStr());
      Alert.alert('Added!', 'Expense logged and roasted.');
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function pickStatementImage() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await doPickImage('camera');
          if (idx === 2) await doPickImage('gallery');
        },
      );
    } else {
      Alert.alert('Import Statement', 'Choose source', [
        { text: 'Camera',  onPress: () => doPickImage('camera') },
        { text: 'Photos',  onPress: () => doPickImage('gallery') },
        { text: 'Cancel',  style: 'cancel' },
      ]);
    }
  }

  async function doPickImage(from: 'camera' | 'gallery') {
    try {
      let res;
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Denied', 'Camera access required.'); return; }
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Denied', 'Photo library access required.'); return; }
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      }
      if (!res.canceled && res.assets[0]) {
        setImportImageUri(res.assets[0].uri);
        setParsedRoast(null);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
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
      if (token) headers['x-app-token'] = token;
      const res = await fetch(`${API_BASE_URL}/api/expenses/parse-statement`, {
        method: 'POST', headers, body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Parse failed' }));
        throw new Error((err as { message?: string }).message);
      }
      const data = await res.json() as { roast?: string };
      setParsedRoast(data.roast ?? 'Statement processed!');
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
        <View style={s.nav}>
          <AppLogo size="xs" />
        </View>
        <View style={s.locked}>
          <Ionicons name="lock-closed" size={48} color={colors.primary} />
          <Text style={s.lockedTitle}>Premium Feature</Text>
          <Text style={s.lockedSub}>Upgrade to Premium to add manual expenses, import bank statements, and track your spending.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Nav bar ── */}
        <View style={s.nav}>
          <AppLogo size="xs" />
        </View>

        {/* ── Page title ── */}
        <View style={s.pageTitleRow}>
          <View style={s.pageTitleIcon}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
          </View>
          <Text style={s.pageTitle}>Bank Statement</Text>
        </View>
        <Text style={s.pageSub}>
          Log expenses manually or import a bank statement — PDF or photo. Every entry gets roasted.
        </Text>

        {/* ── Tab switcher ── */}
        <View style={s.tabRow}>
          {(['manual', 'import'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'manual' ? 'Manual Entry' : 'Import Statement'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Roast tone selector (outside card) ── */}
        <View style={s.toneSection}>
          <Text style={s.toneLabel}>ROAST TONE</Text>
          <View style={s.toneRow}>
            {TONES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[s.toneChip, tone === t.value && s.toneChipActive]}
                onPress={() => setTone(t.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.toneText, tone === t.value && s.toneTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Manual entry card ── */}
        {tab === 'manual' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Add Expense</Text>

            {/* Description */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Uber Eats delivery"
                placeholderTextColor={colors.textDim}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Amount + Date row */}
            <View style={s.fieldRow}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.fieldLabel}>AMOUNT ({currency})</Text>
                <View style={s.inputWithIcon}>
                  <Text style={s.inputPrefix}>{currSym}</Text>
                  <TextInput
                    style={s.inputIconed}
                    placeholder="0.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
              </View>

              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.fieldLabel}>DATE</Text>
                <View style={s.inputWithIcon}>
                  <Ionicons name="calendar-outline" size={15} color={colors.textMuted} style={s.inputIconLeft} />
                  <TextInput
                    style={s.inputIconed}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textDim}
                    value={date}
                    onChangeText={setDate}
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* Category dropdown */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>CATEGORY</Text>
              <TouchableOpacity style={s.dropdownBtn} onPress={() => setCatPickerVisible(true)} activeOpacity={0.8}>
                <Text style={s.dropdownText}>{category}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Submit button */}
            <TouchableOpacity
              style={s.submitWrap}
              onPress={submitManual}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#00E676', '#6BFF9C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.submitBtn}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                    <Text style={s.submitBtnText}>Add & Roast</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Import card ── */}
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
              <TouchableOpacity style={s.submitWrap} onPress={importStatement} disabled={importing} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#00E676', '#6BFF9C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.submitBtn}
                >
                  {importing ? <ActivityIndicator color="#FFFFFF" /> : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                      <Text style={s.submitBtnText}>Import & Roast</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {parsedRoast && (
              <View style={s.roastResult}>
                <Text style={s.roastResultLabel}>THE ROAST</Text>
                <Text style={s.roastResultText}>"{parsedRoast}"</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Logged expenses ── */}
        {loggedExpenses.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>Logged Expenses ({loggedExpenses.length})</Text>
            {pageExpenses.map(exp => {
              const isExpanded = expandedId === exp.id;
              return (
                <TouchableOpacity
                  key={exp.id}
                  style={s.expItem}
                  onPress={() => setExpandedId(isExpanded ? null : exp.id)}
                  activeOpacity={0.75}
                >
                  <View style={s.expTop}>
                    <Text style={[s.expDesc, isExpanded && s.expDescExpanded]} numberOfLines={isExpanded ? undefined : 1}>
                      {exp.description}
                    </Text>
                    <Text style={s.expAmount}>{formatMoney(exp.amount, exp.currency ?? currency)}</Text>
                  </View>
                  <View style={s.expMeta}>
                    <View style={s.catPill}>
                      <Text style={s.catPillText}>{exp.category.toUpperCase()}</Text>
                    </View>
                    {(exp.date ?? exp.createdAt) && (
                      <Text style={s.expDate}>{new Date(exp.date ?? exp.createdAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    )}
                  </View>
                  {exp.roast && <Text style={s.expRoast} numberOfLines={isExpanded ? undefined : 2}>"{exp.roast}"</Text>}
                </TouchableOpacity>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={s.pagination}>
                <TouchableOpacity
                  style={[s.pageBtn, page === 0 && s.pageBtnDisabled]}
                  onPress={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={16} color={page === 0 ? colors.textDim : colors.text} />
                </TouchableOpacity>
                <Text style={s.pageInfo}>{page + 1} / {totalPages}</Text>
                <TouchableOpacity
                  style={[s.pageBtn, page >= totalPages - 1 && s.pageBtnDisabled]}
                  onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={16} color={page >= totalPages - 1 ? colors.textDim : colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Category picker modal ── */}
      <Modal visible={catPickerVisible} animationType="slide" transparent onRequestClose={() => setCatPickerVisible(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setCatPickerVisible(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Select Category</Text>
          <FlatList
            data={CATEGORIES}
            keyExtractor={item => item}
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            renderItem={({ item }) => {
              const selected = item === category;
              return (
                <TouchableOpacity
                  style={[s.modalRow, selected && s.modalRowSelected]}
                  onPress={() => { setCategory(item); setCatPickerVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.modalRowText, selected && s.modalRowTextSelected]}>{item}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const CARD_BG = '#1A1A1A';
const INPUT_BG = '#141414';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 100 },

  nav: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },

  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageTitleIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  pageSub: { ...typography.body, color: colors.textMuted, lineHeight: 22, marginTop: 2 },

  tabRow: {
    flexDirection: 'row', borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: colors.primaryDim },
  tabText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  toneSection: { gap: spacing.xs },
  toneLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    color: colors.textMuted, textTransform: 'uppercase',
  },
  toneRow: { flexDirection: 'row', gap: spacing.sm },
  toneChip: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  toneChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  toneText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  toneTextActive: { color: colors.primary, fontWeight: '700' },

  card: {
    backgroundColor: CARD_BG, borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardSub: { ...typography.bodyMuted, lineHeight: 20 },

  field: { gap: 6 },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: colors.textMuted, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: INPUT_BG, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: 15,
  },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: INPUT_BG, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  inputPrefix: {
    paddingLeft: spacing.md, paddingRight: 4,
    fontSize: 15, color: colors.textMuted, fontWeight: '600',
  },
  inputIconLeft: { marginLeft: spacing.sm },
  inputIconed: {
    flex: 1, paddingVertical: 12, paddingRight: spacing.md, paddingLeft: 4,
    color: colors.text, fontSize: 15,
  },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: INPUT_BG, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  dropdownText: { fontSize: 15, color: colors.text },

  submitWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 16,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  importZone: {
    height: 160, backgroundColor: INPUT_BG, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  importPreview: { width: '100%', height: '100%' },
  importPlaceholder: { alignItems: 'center', gap: spacing.sm },
  importPlaceholderText: { ...typography.bodyMuted },

  roastResult: {
    backgroundColor: colors.primaryDim, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  roastResultLabel: { ...typography.label, color: colors.primary },
  roastResultText: { ...typography.body, fontStyle: 'italic', color: colors.text, lineHeight: 22 },

  historySection: { gap: spacing.sm },
  historyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  expItem: {
    backgroundColor: CARD_BG, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  expTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expDesc: { ...typography.body, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  expDescExpanded: { flexWrap: 'wrap' },
  expAmount: { ...typography.body, fontWeight: '700', color: colors.primary, flexShrink: 0 },
  expMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  catPill: {
    backgroundColor: colors.primaryDim, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  catPillText: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.8 },
  expDate: { ...typography.caption, color: colors.textDim },
  expRoast: { ...typography.bodyMuted, fontStyle: 'italic', lineHeight: 20, marginTop: 2 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingTop: spacing.sm },
  pageBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageInfo: { ...typography.body, color: colors.textMuted, fontWeight: '600' },

  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  lockedTitle: { ...typography.h2 },
  lockedSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, maxHeight: '60%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center',
    marginTop: spacing.sm, marginBottom: spacing.md,
  },
  modalTitle: { ...typography.h3, fontSize: 16, marginBottom: spacing.md },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    marginBottom: spacing.xs, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  modalRowSelected: { backgroundColor: colors.primaryDim, borderColor: colors.primaryBorder },
  modalRowText: { ...typography.body, color: colors.text },
  modalRowTextSelected: { color: colors.primary, fontWeight: '700' },
});
