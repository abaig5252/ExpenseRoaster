import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, ActionSheetIOS, Platform,
  Animated, Easing,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet, API_BASE_URL, getToken } from '../../src/lib/api';
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
  createdAt?: string;
}

interface Summary { monthlyTotal: number; recentRoasts: string[] }
interface UploadResult { expense: Expense; ephemeral?: boolean }

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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [tone, setTone] = useState('savage');
  const [ephemeral, setEphemeral] = useState<Expense | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [displayedAmount, setDisplayedAmount] = useState(0);

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

  // ── Animation values ──────────────────────────────────────────
  const greetingOpacity = useRef(new Animated.Value(0)).current;
  const amountOpacity   = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale      = useRef(new Animated.Value(1)).current;
  const tapScale        = useRef(new Animated.Value(1)).current;
  const plusRotate      = useRef(new Animated.Value(0)).current;
  const wallX           = useRef(new Animated.Value(-30)).current;
  const wallOpacity     = useRef(new Animated.Value(0)).current;
  const badgeScale      = useRef(new Animated.Value(0)).current;
  const pulseAnim       = useRef<Animated.CompositeAnimation | null>(null);
  const tickerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTotal       = useRef(0);

  // Mount: hero fade-ins + button pulse
  useEffect(() => {
    Animated.timing(greetingOpacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    Animated.timing(amountOpacity,   { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }).start();
    Animated.timing(subtitleOpacity, { toValue: 1, duration: 600, delay: 900, useNativeDriver: true }).start();

    // Wall header slide-in
    Animated.parallel([
      Animated.timing(wallX,       { toValue: 0, duration: 550, delay: 500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(wallOpacity, { toValue: 1, duration: 450, delay: 500, useNativeDriver: true }),
    ]).start();

    // Upload button gentle pulse loop
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

  // Amount ticker: count up whenever monthlyTotal changes
  useEffect(() => {
    if (monthlyTotal === prevTotal.current) return;
    const from   = prevTotal.current;
    const to     = monthlyTotal;
    prevTotal.current = to;

    if (tickerRef.current) clearInterval(tickerRef.current);
    const STEPS    = 60;
    const INTERVAL = 1400 / STEPS;
    let step = 0;
    tickerRef.current = setInterval(() => {
      step++;
      const t = step / STEPS;
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayedAmount(Math.round(from + (to - from) * eased));
      if (step >= STEPS) {
        clearInterval(tickerRef.current!);
        setDisplayedAmount(to);
      }
    }, INTERVAL);
  }, [monthlyTotal]);

  // Badge pop when receipt count changes
  useEffect(() => {
    if (receiptExpenses.length === 0) return;
    badgeScale.setValue(0);
    Animated.spring(badgeScale, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }).start();
  }, [receiptExpenses.length]);

  // Upload button tap handler with bounce + icon spin
  const handleUploadPress = useCallback(() => {
    // Bounce
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.93, duration: 90, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
    ]).start();
    // Plus spin 360°
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
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Denied', 'Camera access is required.'); return; }
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Denied', 'Photo library access is required.'); return; }
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
      }
      if (!res.canceled && res.assets[0]) {
        setImageUri(res.assets[0].uri);
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
      const fd = new FormData();
      fd.append('receipt', { uri: imageUri, type: 'image/jpeg', name: 'receipt.jpg' } as never);
      fd.append('tone', tone);
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['x-app-token'] = token;
      const res = await fetch(`${API_BASE_URL}/api/expenses/upload`, { method: 'POST', headers, body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error((err as { message?: string }).message ?? 'Upload failed');
      }
      const data = await res.json() as UploadResult;
      if (data.ephemeral) {
        setEphemeral(data.expense);
        setImageUri(null);
      } else {
        setEphemeral(null);
        setImageUri(null);
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
              ? 'spent this month on things you definitely needed.'
              : `${uploadsRemaining}/1 free upload remaining this month.`}
          </Animated.Text>
        </View>

        {/* ── Upload Button ── */}
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

        {atLimit && (
          <TouchableOpacity style={s.upgradeNudge} activeOpacity={0.7}>
            <Ionicons name="lock-closed" size={14} color={colors.primary} />
            <Text style={s.upgradeNudgeText}>Upgrade for unlimited uploads →</Text>
          </TouchableOpacity>
        )}

        {/* ── Selected image + tone picker ── */}
        {imageUri && !uploading && (
          <View style={s.selectedCard}>
            <Image source={{ uri: imageUri }} style={s.preview} resizeMode="cover" />
            <TouchableOpacity style={s.clearBtn} onPress={() => { setImageUri(null); setEphemeral(null); }}>
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
            <Animated.View style={[s.wallHeader, { opacity: wallOpacity, transform: [{ translateX: wallX }] }]}>
              <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
              <Text style={s.wallTitle}>Receipt Wall</Text>
              {receiptExpenses.length > 0 && (
                <Animated.View style={[s.countBadge, { transform: [{ scale: badgeScale }] }]}>
                  <Text style={s.countText}>{receiptExpenses.length}</Text>
                </Animated.View>
              )}
            </Animated.View>

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
            ) : (
              <View style={s.cardGrid}>
                {receiptExpenses.map((exp, i) => (
                  <ReceiptCard key={exp.id} expense={exp} currency={currency} index={i} />
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Collage-style receipt card — matches web ReceiptCollageCard ──────────────
function ReceiptCard({ expense, currency, index }: { expense: Expense; currency: string; index: number }) {
  const translateY = useRef(new Animated.Value(44)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0, duration: 500, delay: index * 90,
        easing: Easing.out(Easing.back(1.4)), useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 400, delay: index * 90, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotation   = ROTATIONS[index % ROTATIONS.length];
  const dollars    = expense.amount / 100;
  const severity   = dollars < 10 ? 1 : dollars < 50 ? 2 : dollars < 150 ? 3 : dollars < 500 ? 4 : 5;
  const emoji      = CATEGORY_EMOJI[expense.category]  ?? '🧾';
  const pillColor  = CATEGORY_COLOR[expense.category]  ?? '#4A5060';
  const dateStr    = expense.createdAt
    ? new Date(expense.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <Animated.View style={[rc.card, { opacity, transform: [{ translateY }, { rotate: `${rotation}deg` }] }]}>
      {/* Emoji + amount */}
      <View style={rc.topBlock}>
        <Text style={rc.emoji}>{emoji}</Text>
        <Text style={rc.amount}>{formatMoney(expense.amount, expense.currency ?? currency)}</Text>
      </View>

      {/* Description + meta */}
      <View style={rc.metaBlock}>
        <Text style={rc.desc} numberOfLines={1}>{expense.description}</Text>
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
          <Text style={rc.roastText} numberOfLines={4}>"{expense.roast}"</Text>
        </View>
      ) : null}

      {/* Severity flames */}
      <View style={rc.flames}>
        {[1, 2, 3, 4, 5].map(n => (
          <Text key={n} style={[rc.flame, { opacity: n <= severity ? 1 : 0.15 }]}>🔥</Text>
        ))}
      </View>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  card: {
    width: '48%', backgroundColor: '#1A1A1A',
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
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
  flames: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
  flame: { fontSize: 11 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100, gap: spacing.lg },

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
});
