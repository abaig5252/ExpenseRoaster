import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, ActionSheetIOS, Platform,
  Animated, Easing, LayoutAnimation, UIManager,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet, apiFetch, API_BASE_URL, getToken } from '../../src/lib/api';
import { AppLogo } from '../../src/components/AppLogo';
import { CurrencyPickerModal } from '../../src/components/CurrencyPickerModal';
import { colors, spacing, radius, typography } from '../../src/theme';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  roast: string;
  currency: string;
  source?: string;
  date?: string;
  createdAt?: string;
}

function expenseMonth(exp: Expense): string {
  const d = exp.date ? new Date(exp.date) : exp.createdAt ? new Date(exp.createdAt) : new Date();
  return d.toISOString().slice(0, 7);
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

interface Summary { monthlyTotal: number; recentRoasts: string[] }
interface UploadResult { expense: Expense; ephemeral?: boolean }

// ── Verdict text parser ───────────────────────────────────────────
type VSegment =
  | { type: 'text';     text: string }
  | { type: 'bold';     text: string }
  | { type: 'italic';   text: string }
  | { type: 'currency'; text: string }
  | { type: 'count';    text: string }
  | { type: 'category'; text: string; color: string };

const VERDICT_CAT_COLORS: Record<string, string> = {
  'food & drink':  '#E85D26',
  'shopping':      '#C4A832',
  'transport':     '#3BB8A0',
  'entertainment': '#E8526A',
  'health':        '#5BA85E',
  'subscriptions': '#7B6FE8',
  'coffee':        '#C4A832',
  'groceries':     '#C4A832',
  'other':         '#4A5060',
};

const VERDICT_CAT_NAMES = ['Food & Drink','Subscriptions','Entertainment','Transport','Shopping','Groceries','Coffee','Health','Other'];
const V_CURRENCY_RE = /^(?:S\$|CA\$|A\$|NZ\$|HK\$|MX\$|US\$|AU\$|C\$|[$£€¥₹])\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:SGD|USD|GBP|EUR|CAD|AUD|JPY|INR|CHF|MXN|HKD|NZD))?$/i;
const V_COUNT_RE   = /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:receipts?|transactions?|items?)$|^\d+%$/i;
const V_CAT_RE     = new RegExp(`^(${VERDICT_CAT_NAMES.join('|')})$`, 'i');

function classifyBold(inner: string): VSegment {
  const t = inner.trim();
  if (V_CURRENCY_RE.test(t)) return { type: 'currency', text: inner };
  if (V_COUNT_RE.test(t))    return { type: 'count',    text: inner };
  const c = V_CAT_RE.exec(t);
  if (c) return { type: 'category', text: inner, color: VERDICT_CAT_COLORS[c[1].toLowerCase()] ?? '#4A5060' };
  return { type: 'bold', text: inner };
}

function splitByCategories(text: string): VSegment[] {
  const re = new RegExp(`\\b(${VERDICT_CAT_NAMES.join('|')})\\b`, 'gi');
  const segs: VSegment[] = [];
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: 'text', text: text.slice(last, m.index) });
    segs.push({ type: 'category', text: m[1], color: VERDICT_CAT_COLORS[m[1].toLowerCase()] ?? '#4A5060' });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ type: 'text', text: text.slice(last) });
  return segs;
}

function parseVerdict(raw: string): VSegment[] {
  const text = raw.replace(/—/g, ' - ').replace(/\s{2,}/g, ' ').trim();
  const result: VSegment[] = [];
  const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) result.push(classifyBold(part.slice(2, -2)));
    else if (part.startsWith('*') && part.endsWith('*')) result.push({ type: 'italic', text: part.slice(1, -1) });
    else result.push(...splitByCategories(part));
  }
  return result;
}

function VerdictText({ roast }: { roast: string }) {
  const segs = parseVerdict(roast);
  return (
    <Text style={vc.base}>
      {segs.map((seg, i) => {
        switch (seg.type) {
          case 'currency':
            return <Text key={i} style={vc.currency}>{seg.text}</Text>;
          case 'count':
            return <Text key={i} style={vc.count}>{seg.text}</Text>;
          case 'category':
            return <Text key={i} style={[vc.category, { color: seg.color }]}>{seg.text.toUpperCase()}</Text>;
          case 'bold':
            return <Text key={i} style={vc.bold}>{seg.text}</Text>;
          case 'italic':
            return <Text key={i} style={vc.italic}>{seg.text}</Text>;
          default:
            return <Text key={i}>{seg.text}</Text>;
        }
      })}
    </Text>
  );
}

const vc = StyleSheet.create({
  base:     { fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 21 },
  currency: { color: '#00E676', fontWeight: '800', letterSpacing: -0.3 },
  count:    { fontWeight: '800', color: '#FFFFFF' },
  category: { fontWeight: '800', fontSize: 10, letterSpacing: 0.5 },
  bold:     { fontWeight: '700', color: '#FFFFFF' },
  italic:   { fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' },
});

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const TONES = [
  { value: 'savage',     label: '🔥 Savage' },
  { value: 'playful',    label: '😄 Playful' },
  { value: 'supportive', label: '💛 Supportive' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Drink':  '🍔',
  'Shopping':      '🛍️',
  'Transport':     '🚗',
  'Entertainment': '🎬',
  'Health':        '💊',
  'Subscriptions': '📱',
  'Coffee':        '☕',
  'Groceries':     '🛒',
  'Other':         '🧾',
};

const CATEGORY_COLOR: Record<string, string> = {
  'Food & Drink':  '#E85D26',
  'Shopping':      '#C4A832',
  'Transport':     '#3BB8A0',
  'Entertainment': '#E8526A',
  'Health':        '#5BA85E',
  'Subscriptions': '#7B6FE8',
  'Coffee':        '#C4A832',
  'Groceries':     '#C4A832',
  'Other':         '#4A5060',
};

const ROTATIONS = [-2, 1, -1.5, 2, -0.5, 1.5, -1, 0.5, -2.5, 0];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$',
  JPY: '¥', CHF: 'CHF', INR: '₹', SGD: 'S$', MXN: 'MX$',
};

function currencySymbol(code: string) {
  return CURRENCY_SYMBOLS[code] ?? code;
}

function formatMoney(cents: number, currency: string) {
  const sym = currencySymbol(currency);
  return `${sym}${(cents / 100).toFixed(2)}`;
}

export default function UploadScreen() {
  const { user, refreshUser, updateCurrency } = useAuth();
  const queryClient = useQueryClient();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [tone, setTone] = useState('savage');
  const [ephemeral, setEphemeral] = useState<Expense | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [displayedAmount, setDisplayedAmount] = useState(0);

  // ── Select Mode State ─────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const isPremium = user?.tier === 'premium';
  const uploadsUsed = user?.monthlyUploadCount ?? 0;
  const uploadsRemaining = Math.max(0, 1 - uploadsUsed);
  const atLimit = !isPremium && uploadsRemaining === 0;

  const currency = user?.currency ?? 'USD';
  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? 'friend';

  const { data: summary } = useQuery<Summary>({
    queryKey: ['/api/expenses/summary'],
    queryFn: () => apiGet('/api/expenses/summary'),
  });

  const { data: expenses, refetch } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () => apiGet('/api/expenses'),
    enabled: isPremium,
  });

  const receiptExpenses = expenses?.filter(e => e.source === 'receipt') ?? [];
  const monthlyTotal = summary?.monthlyTotal ?? 0;

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const availableMonths = useMemo(() => {
    const months = new Set(receiptExpenses.map(expenseMonth));
    return [...months].sort().reverse();
  }, [receiptExpenses.length]);

  useEffect(() => {
    if (selectedMonth === null && availableMonths.length > 0) {
      const cur = new Date().toISOString().slice(0, 7);
      setSelectedMonth(availableMonths.includes(cur) ? cur : availableMonths[0]);
    }
  }, [availableMonths.length]);

  const filteredReceipts = useMemo(
    () => selectedMonth ? receiptExpenses.filter(e => expenseMonth(e) === selectedMonth) : receiptExpenses,
    [receiptExpenses.length, selectedMonth]
  );

  const { data: monthlyRoastData, isFetching: roastLoading } = useQuery<{ roast: string | null; total: number; count: number }>({
    queryKey: ['/api/expenses/monthly-roast', selectedMonth],
    queryFn: () => apiGet(`/api/expenses/monthly-roast?month=${selectedMonth}&source=receipt`),
    enabled: !!selectedMonth && filteredReceipts.length > 0 && isPremium,
    staleTime: 5 * 60 * 1000,
  });

  // ── Select Mode Callbacks ─────────────────────────────────────────
  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allSelected = filteredReceipts.length > 0 && filteredReceipts.every(e => selectedIds.has(e.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReceipts.map(e => e.id)));
    }
  }, [allSelected, filteredReceipts]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      `Delete ${ids.length} receipt${ids.length !== 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBulkDeleting(true);
            setDeletingIds(new Set(ids));
            try {
              const res = await apiFetch('/api/expenses/bulk', {
                method: 'DELETE',
                body: JSON.stringify({ ids }),
              });
              if (!res.ok) throw new Error('Delete failed');
              await refetch();
              queryClient.invalidateQueries({ queryKey: ['/api/expenses/summary'] });
              setSelectMode(false);
              setSelectedIds(new Set());
            } catch {
              Alert.alert('Error', 'Failed to delete receipts. Please try again.');
            } finally {
              setBulkDeleting(false);
              setDeletingIds(new Set());
            }
          },
        },
      ]
    );
  }, [selectedIds, refetch, queryClient]);

  const handleSingleDelete = useCallback((id: number) => {
    Alert.alert(
      'Delete receipt?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingIds(prev => new Set([...prev, id]));
            try {
              const res = await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
              if (!res.ok) throw new Error('Delete failed');
              await refetch();
              queryClient.invalidateQueries({ queryKey: ['/api/expenses/summary'] });
            } catch {
              Alert.alert('Error', 'Failed to delete receipt. Please try again.');
            } finally {
              setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }
          },
        },
      ]
    );
  }, [refetch, queryClient]);

  // ── Animation values ───────────────────────────────────────────
  const greetingOpacity = useRef(new Animated.Value(0)).current;
  const amountOpacity   = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale      = useRef(new Animated.Value(1)).current;
  const tapScale        = useRef(new Animated.Value(1)).current;
  const plusRotate      = useRef(new Animated.Value(0)).current;
  const wallX           = useRef(new Animated.Value(-30)).current;
  const wallOpacity     = useRef(new Animated.Value(0)).current;
  const badgeScale      = useRef(new Animated.Value(0)).current;
  const deleteBarY      = useRef(new Animated.Value(100)).current;
  const pulseAnim       = useRef<Animated.CompositeAnimation | null>(null);
  const tickerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTotal       = useRef(0);

  // Mount: hero fade-ins + button pulse
  useEffect(() => {
    Animated.timing(greetingOpacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    Animated.timing(amountOpacity,   { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }).start();
    Animated.timing(subtitleOpacity, { toValue: 1, duration: 600, delay: 900, useNativeDriver: true }).start();

    Animated.parallel([
      Animated.timing(wallX,       { toValue: 0, duration: 550, delay: 500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(wallOpacity, { toValue: 1, duration: 450, delay: 500, useNativeDriver: true }),
    ]).start();

    pulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.03, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.00, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseAnim.current.start();

    return () => {
      pulseAnim.current?.stop();
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  // Delete bar slide animation
  useEffect(() => {
    Animated.spring(deleteBarY, {
      toValue: selectMode ? 0 : 100,
      friction: 8, tension: 150, useNativeDriver: true,
    }).start();
  }, [selectMode]);

  // Amount ticker
  useEffect(() => {
    if (monthlyTotal === prevTotal.current) return;
    const from = prevTotal.current;
    const to = monthlyTotal;
    prevTotal.current = to;
    if (tickerRef.current) clearInterval(tickerRef.current);
    const STEPS = 60;
    const INTERVAL = 1400 / STEPS;
    let step = 0;
    tickerRef.current = setInterval(() => {
      step++;
      const t = step / STEPS;
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedAmount(Math.round(from + (to - from) * eased));
      if (step >= STEPS) {
        clearInterval(tickerRef.current!);
        setDisplayedAmount(to);
      }
    }, INTERVAL);
  }, [monthlyTotal]);

  // Badge pop
  useEffect(() => {
    if (receiptExpenses.length === 0) return;
    badgeScale.setValue(0);
    Animated.spring(badgeScale, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }).start();
  }, [receiptExpenses.length]);

  // Upload button tap handler
  const handleUploadPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.93, duration: 90, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
    ]).start();
    plusRotate.setValue(0);
    Animated.timing(plusRotate, {
      toValue: 1, duration: 380,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
    promptImageSource();
  }, [atLimit]);

  function promptImageSource() {
    if (atLimit) {
      Alert.alert('Limit Reached', 'Free plan: 1 upload per month. Upgrade to Premium for unlimited.', [{ text: 'OK' }]);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) pickImage('camera');
          if (idx === 2) pickImage('gallery');
        },
      );
    } else {
      Alert.alert('Upload Receipt', 'Choose a source', [
        { text: 'Camera',  onPress: () => pickImage('camera') },
        { text: 'Photos',  onPress: () => pickImage('gallery') },
        { text: 'Cancel',  style: 'cancel' },
      ]);
    }
  }

  async function pickImage(from: 'camera' | 'gallery') {
    try {
      let res;
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      };
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Denied', 'Camera access is required.'); return; }
        res = await ImagePicker.launchCameraAsync(pickerOptions);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Denied', 'Photo library access is required.'); return; }
        res = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      }
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 ?? null);
        const mime = asset.mimeType ?? 'image/jpeg';
        setImageMime(mime.startsWith('image/') ? mime : 'image/jpeg');
        setEphemeral(null);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function uploadReceipt() {
    if (!imageUri || uploading) return;
    setUploading(true);
    try {
      let base64Data = imageBase64;
      if (!base64Data) {
        base64Data = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      const effectiveMime = (imageMime === 'image/heic' || imageMime === 'image/heif') ? 'image/jpeg' : imageMime;
      const imageDataUrl = `data:${effectiveMime};base64,${base64Data}`;
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['x-app-token'] = token;
      const res = await fetch(`${API_BASE_URL}/api/expenses/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: imageDataUrl, tone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error((err as { message?: string }).message ?? 'Upload failed');
      }
      const data = await res.json() as UploadResult;
      if (data.ephemeral) {
        setEphemeral(data.expense);
        setImageUri(null);
        setImageBase64(null);
      } else {
        setEphemeral(null);
        setImageUri(null);
        setImageBase64(null);
        refetch();
      }
      await refreshUser();
    } catch (e: unknown) {
      Alert.alert('Upload Failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const plusSpin = plusRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={s.root}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Top Nav Bar ── */}
          <View style={s.nav}>
            <AppLogo size="xs" />
            <View style={s.navRight}>
              <TouchableOpacity
                style={s.currencyBadge}
                onPress={() => setCurrencyPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={s.currencyText}>{currency}</Text>
                <Ionicons name="chevron-down" size={10} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{(firstName[0] ?? 'U').toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <CurrencyPickerModal
            visible={currencyPickerVisible}
            current={currency}
            onSelect={updateCurrency}
            onClose={() => setCurrencyPickerVisible(false)}
          />

          {/* ── Hero ── */}
          <View style={s.hero}>
            <Animated.Text style={[s.heroLabel, { opacity: greetingOpacity }]}>
              HEY {firstName.toUpperCase()},{'\n'}
              {isPremium ? "HERE'S YOUR RECEIPT WALL" : "HERE'S YOUR FREE ROAST ZONE"}
            </Animated.Text>

            {isPremium ? (
              <Animated.Text style={[s.heroAmount, { opacity: amountOpacity }]}>
                {formatMoney(displayedAmount, currency)}
              </Animated.Text>
            ) : (
              <Animated.Text style={[s.heroTitle, { opacity: amountOpacity }]}>
                Roast My Receipt
              </Animated.Text>
            )}

            <Animated.Text style={[s.heroSub, { opacity: subtitleOpacity }]}>
              {isPremium
                ? (selectedMonth && filteredReceipts.length > 0
                    ? `spent on receipts in ${fmtMonth(selectedMonth)}.`
                    : 'spent this month on things you definitely needed.')
                : `${uploadsRemaining}/1 free upload remaining this month.`}
            </Animated.Text>
          </View>

          {/* ── Upload Button (hidden in select mode) ── */}
          {!selectMode && (
            <Animated.View style={[s.uploadBtnWrap, { transform: [{ scale: Animated.multiply(pulseScale, tapScale) }] }, atLimit && s.uploadBtnDisabled]}>
              <TouchableOpacity onPress={handleUploadPress} activeOpacity={1} disabled={uploading}>
                <LinearGradient
                  colors={['#00E676', '#6BFF9C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.uploadBtn}
                >
                  {uploading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Animated.View style={{ transform: [{ rotate: plusSpin }] }}>
                        <Ionicons name="add" size={22} color="#FFFFFF" />
                      </Animated.View>
                      <Text style={s.uploadBtnText}>Upload Receipt</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {atLimit && !selectMode && (
            <TouchableOpacity style={s.upgradeNudge} activeOpacity={0.7}>
              <Ionicons name="lock-closed" size={14} color={colors.primary} />
              <Text style={s.upgradeNudgeText}>Upgrade for unlimited uploads →</Text>
            </TouchableOpacity>
          )}

          {/* ── Selected image + tone picker ── */}
          {imageUri && !uploading && !selectMode && (
            <View style={s.selectedCard}>
              <Image source={{ uri: imageUri }} style={s.preview} resizeMode="cover" />
              <TouchableOpacity style={s.clearBtn} onPress={() => { setImageUri(null); setImageBase64(null); setEphemeral(null); }}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={s.toneLabel}>Choose your roast style</Text>
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
              <TouchableOpacity style={s.roastBtnWrap} onPress={uploadReceipt} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#00E676', '#6BFF9C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.roastBtn}
                >
                  <Ionicons name="flame" size={18} color="#FFFFFF" />
                  <Text style={s.roastBtnText}>Roast This Receipt</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Ephemeral roast result (free tier) ── */}
          {ephemeral && (
            <View style={s.ephemeralCard}>
              <TouchableOpacity style={s.closeBtnAbs} onPress={() => setEphemeral(null)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={s.ephLabel}>THE ROAST</Text>
              <Text style={s.ephAmount}>{formatMoney(ephemeral.amount, ephemeral.currency)}</Text>
              <Text style={s.ephDesc}>{ephemeral.description}</Text>
              <View style={s.categoryPill}>
                <Text style={s.categoryPillText}>{ephemeral.category.toUpperCase()}</Text>
              </View>
              <Text style={s.ephRoast}>"{ephemeral.roast}"</Text>
            </View>
          )}

          {/* ── Free tier upgrade panel ── */}
          {!isPremium && !imageUri && !ephemeral && (
            <View style={s.freePanel}>
              <Ionicons name="lock-closed" size={18} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.freePanelTitle}>You're on the Free plan</Text>
                <Text style={s.freePanelSub}>Upgrade to Premium for unlimited uploads, spending history, and more.</Text>
              </View>
            </View>
          )}

          {/* ── Receipt Wall (premium) ── */}
          {isPremium && (
            <View style={s.wallSection}>
              {/* Wall header */}
              <Animated.View style={[s.wallHeader, { opacity: wallOpacity, transform: [{ translateX: wallX }] }]}>
                <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
                <Text style={s.wallTitle}>Receipt Wall</Text>
                {filteredReceipts.length > 0 && (
                  <Animated.View style={[s.countBadge, { transform: [{ scale: badgeScale }] }]}>
                    <Text style={s.countText}>{filteredReceipts.length}</Text>
                  </Animated.View>
                )}
                {/* Select mode controls */}
                <View style={s.selectControls}>
                  {selectMode ? (
                    <>
                      <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.7} style={s.selectBtn}>
                        <Text style={s.selectBtnText}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={exitSelectMode} activeOpacity={0.7} style={s.cancelBtn}>
                        <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : receiptExpenses.length > 0 ? (
                    <TouchableOpacity onPress={enterSelectMode} activeOpacity={0.7}>
                      <Text style={s.selectModeText}>Select</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Animated.View>

              {/* Month filter pills */}
              {availableMonths.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.monthPillsRow}
                  style={s.monthPillsScroll}
                >
                  {availableMonths.map(ym => (
                    <TouchableOpacity
                      key={ym}
                      onPress={() => setSelectedMonth(ym)}
                      style={[s.monthPill, selectedMonth === ym && s.monthPillActive]}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={11}
                        color={selectedMonth === ym ? '#FFFFFF' : colors.textMuted}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[s.monthPillText, selectedMonth === ym && s.monthPillTextActive]}>
                        {fmtMonth(ym)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Monthly verdict roast panel */}
              {!selectMode && selectedMonth && filteredReceipts.length > 0 && (
                <View style={s.verdictPanel}>
                  <View style={s.verdictIcon}>
                    <Ionicons name="flame" size={16} color="#00E676" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.verdictLabel}>{fmtMonth(selectedMonth)} Verdict</Text>
                    {roastLoading ? (
                      <Text style={s.verdictLoading}>Generating your monthly roast…</Text>
                    ) : monthlyRoastData?.roast ? (
                      <VerdictText roast={monthlyRoastData.roast} />
                    ) : null}
                  </View>
                </View>
              )}

              {receiptExpenses.length === 0 ? (
                <View style={s.emptyWall}>
                  <View style={s.emptyIcon}>
                    <Ionicons name="receipt-outline" size={32} color={colors.textDim} />
                  </View>
                  <Text style={s.emptyTitle}>No receipts yet</Text>
                  <Text style={s.emptySub}>Upload a receipt photo and watch your poor decisions get immortalised on the wall.</Text>
                  <TouchableOpacity style={s.emptyBtnWrap} onPress={promptImageSource} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#00E676', '#6BFF9C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.emptyBtn}
                    >
                      <Text style={s.emptyBtnText}>Add First Receipt</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : filteredReceipts.length === 0 ? (
                <View style={s.emptyWall}>
                  <Text style={s.emptyTitle}>No receipts in {selectedMonth ? fmtMonth(selectedMonth) : 'this month'}</Text>
                  <Text style={s.emptySub}>Nothing uploaded for this month. Pick another month above.</Text>
                </View>
              ) : (
                <View style={s.cardGrid}>
                  {filteredReceipts.map((exp, i) => (
                    <ReceiptCard
                      key={exp.id}
                      expense={exp}
                      currency={currency}
                      index={i}
                      isSelectMode={selectMode}
                      isSelected={selectedIds.has(exp.id)}
                      isExiting={deletingIds.has(exp.id)}
                      onSelect={() => toggleSelect(exp.id)}
                      onDelete={() => handleSingleDelete(exp.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

        </ScrollView>

        {/* ── Sticky Bulk Delete Bar ── */}
        <Animated.View
          style={[s.deleteBar, { transform: [{ translateY: deleteBarY }] }]}
          pointerEvents={selectMode ? 'auto' : 'none'}
        >
          <TouchableOpacity
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0 || bulkDeleting}
            activeOpacity={0.85}
            style={[
              s.deleteBarBtn,
              selectedIds.size === 0 && s.deleteBarBtnDisabled,
            ]}
          >
            {bulkDeleting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="trash-outline" size={18} color={selectedIds.size === 0 ? 'rgba(255,82,82,0.4)' : '#FFFFFF'} />
            )}
            <Text style={[s.deleteBarText, selectedIds.size === 0 && s.deleteBarTextDisabled]}>
              {selectedIds.size === 0
                ? 'Select receipts to delete'
                : `Delete (${selectedIds.size} selected)`}
            </Text>
          </TouchableOpacity>
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

// ── Per-flame flicker timings ────────────────────────────────────────
const FLICKER_DURATIONS = [840, 1120, 740, 1000, 1220];

// ── Receipt card ─────────────────────────────────────────────────────
interface ReceiptCardProps {
  expense: Expense;
  currency: string;
  index: number;
  isSelectMode?: boolean;
  isSelected?: boolean;
  isExiting?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

function ReceiptCard({ expense, currency, index, isSelectMode = false, isSelected = false, isExiting = false, onSelect, onDelete }: ReceiptCardProps) {
  const translateY = useRef(new Animated.Value(44)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const exitScale  = useRef(new Animated.Value(1)).current;
  const chevronRot = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

  const flameScales    = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;
  const flameOpacities = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  const flameLoops     = useRef<(Animated.CompositeAnimation | null)[]>([null, null, null, null, null]);

  const rotation = ROTATIONS[index % ROTATIONS.length];
  const dollars  = expense.amount / 100;
  const severity = dollars < 10 ? 1 : dollars < 50 ? 2 : dollars < 150 ? 3 : dollars < 500 ? 4 : 5;
  const emoji    = CATEGORY_EMOJI[expense.category] ?? '🧾';
  const pillColor = CATEGORY_COLOR[expense.category] ?? '#4A5060';
  const dateStr  = expense.createdAt
    ? new Date(expense.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const chevronDeg = chevronRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const cardDelay = index * 90;

  // Exit animation when being deleted
  useEffect(() => {
    if (isExiting) {
      Animated.parallel([
        Animated.timing(exitScale,  { toValue: 0.85, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,    duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [isExiting]);

  function startFlicker(i: number) {
    const dur = FLICKER_DURATIONS[i];
    const half = Math.round(dur / 2);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(flameScales[i],    { toValue: 1.09, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(flameOpacities[i], { toValue: 0.75, duration: half, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(flameScales[i],    { toValue: 0.94, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(flameOpacities[i], { toValue: 1.0,  duration: half, useNativeDriver: true }),
        ]),
      ])
    );
    flameLoops.current[i] = loop;
    loop.start();
  }

  function stopFlicker(i: number) {
    flameLoops.current[i]?.stop();
    flameLoops.current[i] = null;
  }

  function flareAll() {
    [0, 1, 2, 3, 4].forEach(stopFlicker);
    Animated.parallel(
      [0, 1, 2, 3, 4].map(i =>
        Animated.sequence([
          Animated.timing(flameScales[i], {
            toValue: 1.4, duration: 90,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.spring(flameScales[i], {
            toValue: i < severity ? 1.0 : 0.7,
            friction: 4, tension: 200, useNativeDriver: true,
          }),
        ])
      )
    ).start(() => {
      [0, 1, 2, 3, 4].forEach(i => { if (i < severity) startFlicker(i); });
    });
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0, duration: 500, delay: cardDelay,
        easing: Easing.out(Easing.back(1.4)), useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 400, delay: cardDelay, useNativeDriver: true,
      }),
    ]).start();

    [0, 1, 2, 3, 4].forEach(i => {
      if (i >= severity) {
        flameScales[i].setValue(0.85);
        flameOpacities[i].setValue(0.13);
      }
    });

    [0, 1, 2, 3, 4].filter(i => i < severity).forEach((i, pos) => {
      Animated.sequence([
        Animated.delay(cardDelay + 300 + pos * 155),
        Animated.parallel([
          Animated.spring(flameScales[i], { toValue: 1, friction: 3, tension: 280, useNativeDriver: true }),
          Animated.timing(flameOpacities[i], { toValue: 1, duration: 180, useNativeDriver: true }),
        ]),
      ]).start(() => startFlicker(i));
    });

    return () => { [0, 1, 2, 3, 4].forEach(stopFlicker); };
  }, []);

  function toggleExpand() {
    if (isSelectMode) { onSelect?.(); return; }
    LayoutAnimation.configureNext({
      duration: 320,
      create: { type: 'easeInEaseOut', property: 'opacity', duration: 200 },
      update: { type: 'spring', springDamping: 0.72 },
      delete: { type: 'easeInEaseOut', property: 'opacity', duration: 150 },
    });
    Animated.timing(chevronRot, {
      toValue: expanded ? 0 : 1, duration: 260,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    setExpanded(prev => !prev);
  }

  return (
    <Animated.View
      style={[
        rc.card,
        expanded && !isSelectMode && rc.cardExpanded,
        isSelected && rc.cardSelected,
        {
          opacity,
          transform: [
            { translateY },
            { scale: exitScale },
            { rotate: isSelectMode ? '0deg' : `${rotation}deg` },
          ],
        },
      ]}
    >
      {/* Checkbox — shown in select mode */}
      {isSelectMode && (
        <TouchableOpacity
          onPress={() => onSelect?.()}
          style={[rc.checkbox, isSelected && rc.checkboxSelected]}
          activeOpacity={0.7}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={13} color="#000000" />
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPressIn={isSelectMode ? undefined : flareAll}
        onPress={toggleExpand}
        activeOpacity={0.85}
        style={rc.cardInner}
      >
        {/* Emoji + amount */}
        <View style={rc.topBlock}>
          <Text style={rc.emoji}>{emoji}</Text>
          <Text style={rc.amount}>{formatMoney(expense.amount, expense.currency ?? currency)}</Text>
        </View>

        {/* Description + meta */}
        <View style={rc.metaBlock}>
          <Text style={rc.desc} numberOfLines={expanded ? undefined : 1}>{expense.description}</Text>
          <View style={rc.pillRow}>
            <View style={[rc.pill, { backgroundColor: pillColor }]}>
              <Text style={rc.pillText}>{expense.category.toUpperCase()}</Text>
            </View>
            {dateStr ? <Text style={rc.date}>{dateStr}</Text> : null}
          </View>
        </View>

        {/* Roast quote */}
        {expense.roast ? (
          <View style={rc.roastBox}>
            <Text style={rc.roastText} numberOfLines={expanded ? undefined : 4}>"{expense.roast}"</Text>
          </View>
        ) : null}

        {/* Severity flames + chevron */}
        {!isSelectMode && (
          <View style={rc.footer}>
            <View style={rc.flames}>
              {[0, 1, 2, 3, 4].map(i => (
                <Animated.Text
                  key={i}
                  style={[rc.flame, { opacity: flameOpacities[i], transform: [{ scale: flameScales[i] }] }]}
                >
                  🔥
                </Animated.Text>
              ))}
            </View>
            <Animated.View style={{ transform: [{ rotate: chevronDeg }] }}>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.35)" />
            </Animated.View>
          </View>
        )}

        {/* Delete button — shown when expanded and not in select mode */}
        {expanded && !isSelectMode && (
          <TouchableOpacity
            onPress={onDelete}
            style={rc.deleteRow}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color="#FF5252" />
            <Text style={rc.deleteText}>Delete receipt</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  card: {
    width: '48%', backgroundColor: '#1A1A1A',
    borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: 'rgba(0,230,118,0.22)',
    shadowOpacity: 0.55, shadowRadius: 16, elevation: 10,
  },
  cardSelected: {
    borderColor: '#00E676',
    borderWidth: 2,
    shadowColor: '#00E676', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  cardInner: { padding: 16 },
  topBlock: { alignItems: 'center', marginBottom: 10 },
  emoji: { fontSize: 30, marginBottom: 6 },
  amount: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, lineHeight: 30 },
  metaBlock: { alignItems: 'center', marginBottom: 10 },
  desc: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 6 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  pill: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  date: { fontSize: 10, color: '#4A5060' },
  roastBox: {
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.18)',
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  roastText: { fontSize: 11, fontStyle: 'italic', color: '#69FF9C', lineHeight: 17 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flames: { flexDirection: 'row', gap: 2 },
  flame: { fontSize: 11 },
  checkbox: {
    position: 'absolute', top: 10, left: 10, zIndex: 10,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  deleteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,82,82,0.15)',
  },
  deleteText: { fontSize: 12, color: '#FF5252', fontWeight: '600' },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  currencyText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#0D0D0D' },

  hero: { gap: spacing.sm, marginBottom: spacing.xs },
  heroLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    color: colors.textMuted, textTransform: 'uppercase', lineHeight: 17,
  },
  heroAmount: { fontSize: 52, fontWeight: '800', color: colors.text, letterSpacing: -1.5, lineHeight: 60 },
  heroTitle: { fontSize: 36, fontWeight: '800', color: colors.text, lineHeight: 42 },
  heroSub: { ...typography.body, color: colors.textMuted, lineHeight: 22 },

  uploadBtnWrap: { alignSelf: 'flex-start', borderRadius: 16, overflow: 'hidden' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, paddingVertical: 18, paddingHorizontal: 28,
  },
  uploadBtnDisabled: { opacity: 0.45 },
  uploadBtnText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  upgradeNudge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    alignSelf: 'center', marginTop: -spacing.sm,
  },
  upgradeNudgeText: { ...typography.caption, color: colors.primary },

  selectedCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  preview: { width: '100%', height: 220 },
  clearBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  toneLabel: { ...typography.label, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  toneRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  toneChip: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  toneChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  toneText: { ...typography.caption, color: colors.textMuted },
  toneTextActive: { color: colors.primary, fontWeight: '700' },
  roastBtnWrap: { margin: spacing.lg, marginTop: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  roastBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
  },
  roastBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  ephemeralCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  closeBtnAbs: { position: 'absolute', top: spacing.md, right: spacing.md },
  ephLabel: { ...typography.label, color: colors.primary },
  ephAmount: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  ephDesc: { ...typography.body, fontWeight: '600', color: colors.text },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: colors.primaryDim,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  categoryPillText: { ...typography.caption, color: colors.primary, fontWeight: '700', fontSize: 10 },
  ephRoast: { ...typography.body, fontStyle: 'italic', lineHeight: 24, color: colors.primary, marginTop: spacing.xs },

  freePanel: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primaryDim, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  freePanelTitle: { ...typography.body, fontWeight: '700', color: colors.text },
  freePanelSub: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },

  wallSection: { gap: spacing.md },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  wallHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wallTitle: { ...typography.h3, fontSize: 20 },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },

  selectControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' },
  selectModeText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  selectBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  selectBtnText: { fontSize: 12, fontWeight: '700', color: '#00E676' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4 },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },

  monthPillsScroll: { marginTop: -spacing.xs },
  monthPillsRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  monthPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm + 2, paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  monthPillActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
    shadowColor: '#00E676', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  monthPillText: { ...typography.caption, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  monthPillTextActive: { color: '#FFFFFF', fontWeight: '800' },

  verdictPanel: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
    borderRadius: radius.xl, padding: spacing.md,
  },
  verdictIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(0,230,118,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  verdictLabel: { fontSize: 10, fontWeight: '800', color: '#00E676', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  verdictLoading: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  verdictRoast: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', lineHeight: 20 },

  emptyWall: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { ...typography.h3, textAlign: 'center' },
  emptySub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  emptyBtnWrap: { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  emptyBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  deleteBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm,
    backgroundColor: 'rgba(10,10,10,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  deleteBarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 16, borderRadius: 16,
    backgroundColor: '#FF5252',
  },
  deleteBarBtnDisabled: {
    backgroundColor: 'rgba(255,82,82,0.12)',
  },
  deleteBarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  deleteBarTextDisabled: { color: 'rgba(255,82,82,0.4)' },
});
