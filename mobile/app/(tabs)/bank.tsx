import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, Platform,
  ActionSheetIOS, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requestCameraPermission, requestPhotoLibraryPermission } from '../../src/lib/permissions';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet, apiDelete, apiPatch, API_BASE_URL, getToken } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { CurrencyPickerModal } from '../../src/components/CurrencyPickerModal';
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

const TONES = [
  { value: 'hells_kitchen', label: "Hell's Kitchen 🔪", desc: 'Gordon Ramsay mode' },
  { value: 'medium_rare',   label: 'Medium Rare 🥩',   desc: 'Between friends' },
  { value: 'gentle_nudge',  label: 'Gentle Nudge 🌱',  desc: 'Light jab' },
];

const ALL_CATEGORIES = [
  'Food & Drink', 'Groceries', 'Shopping', 'Transport',
  'Travel', 'Entertainment', 'Health & Fitness', 'Subscriptions', 'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drink':    '#E85D26',
  'Groceries':       '#C4A832',
  'Shopping':        '#C4A832',
  'Transport':       '#3BB8A0',
  'Travel':          '#4A9FE8',
  'Entertainment':   '#E8526A',
  'Health & Fitness':'#5BA85E',
  'Subscriptions':   '#7B6FE8',
  'Coffee':          '#7B6FE8',
  'Other':           '#4A5060',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$',
  JPY: '¥', CHF: 'Fr', INR: '₹', SGD: 'S$', MXN: '$',
};

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

  const [tone, setTone] = useState('hells_kitchen');
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importImageUri, setImportImageUri] = useState<string | null>(null);
  const [importCurrency, setImportCurrency] = useState(currency);
  const [importCurrencyPickerVisible, setImportCurrencyPickerVisible] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importFileType, setImportFileType] = useState<'image' | 'pdf'>('image');
  const [previewResult, setPreviewResult] = useState<{
    transactions: { description: string; amount: number; date: string }[];
    detectedMonth: string;
    transactionCount: number;
  } | null>(null);
  const [editMonth, setEditMonth] = useState('');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [catPicker, setCatPicker] = useState<{ id: number; current: string } | null>(null);
  const [savingCatId, setSavingCatId] = useState<number | null>(null);
  const [catOverrides, setCatOverrides] = useState<Record<number, string>>({});

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () => apiGet('/api/expenses'),
    enabled: isPremium,
  });

  const loggedExpenses = expenses?.filter(e => e.source === 'manual' || e.source === 'bank_statement') ?? [];
  const totalPages = Math.ceil(loggedExpenses.length / PAGE_SIZE);
  const pageExpenses = loggedExpenses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function pickStatementImage() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library', 'Choose PDF File'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await doPickImage('camera');
          if (idx === 2) await doPickImage('gallery');
          if (idx === 3) await doPickFile();
        },
      );
    } else {
      Alert.alert('Import Statement', 'Choose source', [
        { text: 'Camera',         onPress: () => doPickImage('camera') },
        { text: 'Photos',         onPress: () => doPickImage('gallery') },
        { text: 'PDF File',        onPress: () => doPickFile() },
        { text: 'Cancel',         style: 'cancel' },
      ]);
    }
  }

  async function doPickImage(from: 'camera' | 'gallery') {
    try {
      let res;
      if (from === 'camera') {
        const result = await requestCameraPermission();
        if (result === 'denied') return;
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      } else {
        const result = await requestPhotoLibraryPermission();
        if (result === 'denied') return;
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      }
      if (!res.canceled && res.assets[0]) {
        setImportImageUri(res.assets[0].uri);
        setImportFileName(null);
        setImportFileType('image');
        setPreviewResult(null);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function doPickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        setImportImageUri(asset.uri);
        setImportFileName(asset.name ?? 'document.pdf');
        setImportFileType('pdf');
        setPreviewResult(null);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function scanStatement() {
    if (!importImageUri || scanning) return;
    setScanning(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(importImageUri, { encoding: FileSystem.EncodingType.Base64 });
      let dataUrl: string;
      let format: string;
      if (importFileType === 'pdf') {
        dataUrl = `data:application/pdf;base64,${base64}`;
        format = 'pdf';
      } else {
        dataUrl = `data:image/jpeg;base64,${base64}`;
        format = 'image';
      }
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['x-app-token'] = token;
      const res = await fetch(`${API_BASE_URL}/api/expenses/preview-statement`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: dataUrl, format, currency: importCurrency }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Scan failed' }));
        throw new Error((err as { message?: string }).message);
      }
      const result = await res.json() as {
        transactions: { description: string; amount: number; date: string }[];
        detectedMonth: string;
        transactionCount: number;
      };
      setPreviewResult(result);
      setEditMonth(result.detectedMonth);
    } catch (e: unknown) {
      Alert.alert('Scan Failed', (e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function importStatement() {
    if (!previewResult || importing) return;
    setImporting(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['x-app-token'] = token;
      const res = await fetch(`${API_BASE_URL}/api/expenses/import-csv`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactions: previewResult.transactions, month: editMonth, tone, currency: importCurrency }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Import failed' }));
        throw new Error((err as { message?: string }).message);
      }
      const data = await res.json() as { imported?: number };
      Alert.alert('Imported!', `${data.imported ?? 0} transactions imported and roasted.`);
      setImportImageUri(null);
      setImportFileName(null);
      setImportFileType('image');
      setPreviewResult(null);
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

  async function editCategory(id: number, category: string) {
    setCatPicker(null);
    setSavingCatId(id);
    setCatOverrides(prev => ({ ...prev, [id]: category }));
    try {
      await apiPatch(`/api/expenses/${id}/category`, { category });
      qc.invalidateQueries({ queryKey: ['/api/expenses'] });
      Alert.alert('Category Updated', `AI will remember "${category}" for this merchant on future imports.`);
    } catch (e: unknown) {
      setCatOverrides(prev => { const n = { ...prev }; delete n[id]; return n; });
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSavingCatId(null);
    }
  }

  function openCategoryPicker(exp: Expense) {
    const current = catOverrides[exp.id] ?? exp.category;
    if (Platform.OS === 'ios') {
      const options = ['Cancel', ...ALL_CATEGORIES.map(c => c === current ? `✓ ${c}` : c)];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, title: 'Edit Category' },
        (idx) => {
          if (idx === 0) return;
          editCategory(exp.id, ALL_CATEGORIES[idx - 1]);
        },
      );
    } else {
      setCatPicker({ id: exp.id, current });
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
          <Text style={s.lockedSub}>Upgrade to Premium to import bank and credit card statements and track your spending history.</Text>
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
          Upload your bank or credit card statement — photo or PDF. Every transaction gets roasted.
        </Text>

        {/* ── Roast tone selector ── */}
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
                <Text style={[s.toneDesc, tone === t.value && s.toneDescActive]}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Import card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Import Statement</Text>
          <Text style={s.cardSub}>Take a photo of your statement or upload a PDF — tap to choose</Text>

          <TouchableOpacity style={s.importZone} onPress={pickStatementImage} activeOpacity={0.8}>
            {importImageUri ? (
              importFileType === 'image' ? (
                <Image source={{ uri: importImageUri }} style={s.importPreview} resizeMode="cover" />
              ) : (
                <View style={s.importFilePlaceholder}>
                  <Ionicons name="document" size={38} color={colors.primary} />
                  <Text style={s.importFileNameText} numberOfLines={2}>{importFileName}</Text>
                  <Text style={s.importFileReadyText}>Ready to scan · tap to change</Text>
                </View>
              )
            ) : (
              <View style={s.importPlaceholder}>
                <Ionicons name="cloud-upload-outline" size={36} color={colors.textDim} />
                <Text style={s.importPlaceholderText}>Tap to upload</Text>
                <Text style={s.importPlaceholderSub}>Camera · Photos · PDF</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Statement Currency ── */}
          <View style={s.currencyRow}>
            <Text style={s.fieldLabel}>STATEMENT CURRENCY</Text>
            <TouchableOpacity
              style={s.currencyBtn}
              onPress={() => setImportCurrencyPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={s.currencyBtnText}>{importCurrency}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <CurrencyPickerModal
            visible={importCurrencyPickerVisible}
            current={importCurrency}
            onSelect={(code) => setImportCurrency(code)}
            onClose={() => setImportCurrencyPickerVisible(false)}
          />

          {/* Step 1: Scan button — shown when image selected but no preview yet */}
          {importImageUri && !previewResult && (
            <TouchableOpacity style={s.submitWrap} onPress={scanStatement} disabled={scanning} activeOpacity={0.85}>
              <LinearGradient
                colors={['#00E676', '#6BFF9C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.submitBtn}
              >
                {scanning ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                    <Text style={s.submitBtnText}>Scan Statement</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Step 2: Preview result with month editor + import button */}
          {previewResult && (
            <View style={s.previewBox}>
              <View style={s.previewHeader}>
                <Ionicons name="checkmark-circle" size={18} color="#00E676" />
                <Text style={s.previewFoundText}>
                  {previewResult.transactionCount} transaction{previewResult.transactionCount !== 1 ? 's' : ''} found
                </Text>
              </View>

              <Text style={s.fieldLabel}>STATEMENT MONTH</Text>
              <TextInput
                style={s.monthInput}
                value={editMonth}
                onChangeText={setEditMonth}
                placeholder="YYYY-MM"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
                maxLength={7}
              />
              <Text style={s.previewHint}>Confirm this matches your statement — change if needed (YYYY-MM)</Text>

              <View style={s.twoButtonRow}>
                <TouchableOpacity
                  style={s.rescanBtn}
                  onPress={() => setPreviewResult(null)}
                  disabled={importing}
                  activeOpacity={0.7}
                >
                  <Text style={s.rescanBtnText}>Re-scan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.submitWrapInline, importing && { opacity: 0.5 }]}
                  onPress={importStatement}
                  disabled={importing || !editMonth}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#00E676', '#6BFF9C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.submitBtnInline}
                  >
                    {importing ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Ionicons name="flame-outline" size={16} color="#FFFFFF" />
                        <Text style={s.submitBtnText}>Import & Roast All</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Imported expenses ── */}
        {loggedExpenses.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>Imported Expenses ({loggedExpenses.length})</Text>
            {pageExpenses.map(exp => {
              const isExpanded = expandedId === exp.id;
              const displayCat = catOverrides[exp.id] ?? exp.category;
              const catColor = CATEGORY_COLORS[displayCat] ?? '#4A5060';
              const isSavingCat = savingCatId === exp.id;
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
                    {/* Tappable category pill */}
                    <TouchableOpacity
                      style={[s.catPill, { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` }]}
                      onPress={() => openCategoryPicker(exp)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      {isSavingCat
                        ? <ActivityIndicator size="small" color={catColor} style={{ width: 40 }} />
                        : <>
                            <View style={[s.catDot, { backgroundColor: catColor }]} />
                            <Text style={[s.catPillText, { color: catColor }]}>{displayCat}</Text>
                            <Ionicons name="chevron-down" size={10} color={catColor} />
                          </>
                      }
                    </TouchableOpacity>
                    {(exp.date ?? exp.createdAt) && (
                      <Text style={s.expDate}>{new Date(exp.date ?? exp.createdAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    )}
                  </View>
                  {exp.roast && <Text style={s.expRoast} numberOfLines={isExpanded ? undefined : 2}>"{exp.roast}"</Text>}
                  {isExpanded && (
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={() => {
                        Alert.alert('Delete Expense', 'Remove this transaction?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(exp.id) },
                        ]);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color="rgba(255,82,82,0.7)" />
                      <Text style={s.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}
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

      {/* ── Android category picker Modal ── */}
      <Modal
        visible={!!catPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setCatPicker(null)}
      >
        <TouchableOpacity style={s.catModalBackdrop} activeOpacity={1} onPress={() => setCatPicker(null)} />
        <View style={s.catSheet}>
          <View style={s.catSheetHandle} />
          <View style={s.catSheetHeader}>
            <View style={s.catSheetIconWrap}>
              <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.catSheetTitle}>Edit Category</Text>
              <Text style={s.catSheetSub}>AI will remember this for future imports</Text>
            </View>
            <TouchableOpacity onPress={() => setCatPicker(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={s.catGrid}>
            {ALL_CATEGORIES.map(cat => {
              const color = CATEGORY_COLORS[cat] ?? '#4A5060';
              const isCurrent = catPicker?.current === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[s.catGridItem, { backgroundColor: `${color}22`, borderColor: isCurrent ? color : `${color}44` }]}
                  onPress={() => catPicker && editCategory(catPicker.id, cat)}
                  activeOpacity={0.75}
                >
                  <View style={[s.catDot, { backgroundColor: color }]} />
                  <Text style={[s.catGridText, { color }]}>{cat}</Text>
                  {isCurrent && <Ionicons name="checkmark-circle" size={14} color={color} />}
                </TouchableOpacity>
              );
            })}
          </View>
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
  toneText: { ...typography.caption, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  toneTextActive: { color: colors.primary, fontWeight: '700' },
  toneDesc: { fontSize: 10, color: colors.textMuted, opacity: 0.65, marginTop: 2, textAlign: 'center' },
  toneDescActive: { color: colors.primary, opacity: 0.8 },

  card: {
    backgroundColor: CARD_BG, borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardSub: { ...typography.bodyMuted, lineHeight: 20 },

  submitWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 16,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: colors.textMuted, textTransform: 'uppercase',
  },
  currencyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  currencyBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },

  importZone: {
    height: 160, backgroundColor: INPUT_BG, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  importPreview: { width: '100%', height: '100%' },
  importPlaceholder: { alignItems: 'center', gap: spacing.sm },
  importPlaceholderText: { ...typography.bodyMuted },
  importPlaceholderSub: { fontSize: 11, color: colors.textDim, letterSpacing: 0.5 },
  importFilePlaceholder: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  importFileNameText: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },
  importFileReadyText: { fontSize: 11, color: colors.textMuted },

  previewBox: {
    backgroundColor: 'rgba(0,230,118,0.05)', borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.25)',
    padding: spacing.md, gap: spacing.sm,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  previewFoundText: { fontSize: 14, fontWeight: '700', color: colors.text },
  previewHint: { fontSize: 11, color: colors.textMuted, marginTop: -4 },
  monthInput: {
    backgroundColor: INPUT_BG, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    color: colors.text, fontSize: 15, fontWeight: '600',
  },
  twoButtonRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  rescanBtn: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  rescanBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  submitWrapInline: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  submitBtnInline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 14,
  },

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
  expAmount: { fontSize: 15, fontWeight: '700', color: colors.text },
  expMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1,
  },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  expDate: { ...typography.caption, color: colors.textMuted },
  expRoast: { ...typography.caption, fontStyle: 'italic', color: colors.textMuted, lineHeight: 18 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,82,82,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,82,82,0.2)',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,82,82,0.7)' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: spacing.sm },
  pageBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageInfo: { ...typography.body, color: colors.textMuted, minWidth: 40, textAlign: 'center' },

  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  lockedTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  lockedSub: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  catModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  catSheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#2a2a2a',
    paddingBottom: 36, position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  catSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  catSheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  catSheetIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  catSheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  catSheetSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm,
  },
  catGridItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5,
  },
  catGridText: { fontSize: 13, fontWeight: '700' },
});
