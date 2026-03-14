import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { apiGet, apiPost } from '../../src/lib/api';
import { colors, spacing, radius, typography } from '../../src/theme';

interface MerchantInsight {
  merchant: string;
  totalSpent: number;
  visits: number;
  insight: string;
}

interface SavingsOpportunity {
  category: string;
  currentAnnualSpend: number;
  alternative: string;
  potentialAnnualSaving: number;
  tip: string;
}

interface AnnualReportData {
  totalSpend: number;
  currency: string;
  transactionCount: number;
  reportYear: number;
  ytdLabel?: string;
  top5Categories: Array<{ category: string; amount: number }>;
  worstMonth: { month: string; amount: number };
  bestMonth: { month: string; amount: number };
  avgMonthlySpend: number;
  projection5yr: number;
  allTimeYearsRange?: string;
  allTimeTotalSpend?: number;
  roast: string;
  spendingPersonality: { title: string; description: string };
  behavioralAnalysis: string;
  monthlyTrend: string;
  merchantInsights: MerchantInsight[];
  savingsOpportunities: SavingsOpportunity[];
  improvements: string[];
  funFact: string;
  generatedAt?: string;
}

function fmt(cents: number, currency: string) {
  return `${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function fmtMonth(ym: string) {
  if (!ym) return '—';
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isDataError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('transaction') || lower.includes('upload');
}

function SectionHeader({ icon, label, color = colors.primary }: { icon: string; label: string; color?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as never} size={18} color={color} />
      <Text style={[styles.sectionTitle, { color }]}>{label}</Text>
    </View>
  );
}

export default function AnnualScreen() {
  const { user, refreshUser } = useAuth();
  const [purchasing, setPurchasing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [freshReport, setFreshReport] = useState<AnnualReportData | null>(null);
  const [savedReport, setSavedReport] = useState<AnnualReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevHasAccess = useRef<boolean | undefined>(undefined);

  const hasAccess = !!(user?.hasAnnualReport);
  const reportData = freshReport || savedReport;

  // Load saved report on mount
  useEffect(() => {
    apiGet<AnnualReportData>('/api/expenses/annual-report/latest')
      .then(data => setSavedReport(data))
      .catch(() => {});
  }, []);

  // Refresh user when tab comes back into focus (detects payment return from browser)
  useFocusEffect(useCallback(() => {
    refreshUser();
  }, []));

  // Auto-generate when payment is detected: hasAccess just flipped true and a saved report exists
  useEffect(() => {
    if (hasAccess && prevHasAccess.current === false && savedReport && !generating) {
      generateReport();
    }
    prevHasAccess.current = hasAccess;
  }, [hasAccess]);

  async function purchaseReport() {
    setPurchasing(true);
    try {
      const products = await apiGet<any[]>('/api/stripe/products');
      const annualProduct = products.find(
        (p: any) => p.price_metadata?.plan === 'annual_report' || p.metadata?.plan === 'annual_report'
      );
      if (!annualProduct?.price_id) {
        throw new Error('Annual report product not found. Please try again later.');
      }
      const data = await apiGet<{ url?: string }>(
        `/api/stripe/checkout?priceId=${encodeURIComponent(annualProduct.price_id)}&mode=payment`
      );
      if (data.url) await Linking.openURL(data.url);
    } catch (e: unknown) {
      setError((e as Error).message || 'Could not open checkout.');
    } finally {
      setPurchasing(false);
    }
  }

  async function generateReport() {
    setGenerating(true);
    setError(null);
    try {
      const data = await apiPost<AnnualReportData>('/api/expenses/annual-report');
      setFreshReport(data);
      setSavedReport(data);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  // No purchase → full purchase screen
  if (!hasAccess && !savedReport) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Ionicons name="trophy" size={40} color={colors.primary} />
            <Text style={styles.pageTitle}>Annual Report</Text>
          </View>
          <View style={styles.promoCard}>
            <Text style={styles.promoTitle}>Your Year in Shame</Text>
            <Text style={styles.promoSub}>
              Get a brutally honest AI-powered breakdown of your entire year's spending — with roasts, deep behavioral analysis, merchant insights, and real money-saving alternatives.
            </Text>
            <View style={styles.featureList}>
              {[
                'Full-year roast based on every transaction',
                'Your personal spending personality type',
                'Deep behavioral analysis',
                'Per-merchant insights & tips',
                '5 savings opportunities with real alternatives',
                'Best & worst month comparison',
                'Spending trend analysis',
                '5-year projection',
                'Fun facts from your data',
              ].map(f => (
                <View key={f} style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.price}>$29.99</Text>
              <Text style={styles.priceNote}>one-time payment</Text>
            </View>
            {error && (
              <View style={isDataError(error) ? styles.amberBox : styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={isDataError(error) ? '#F59E0B' : '#FF6B6B'} />
                <Text style={isDataError(error) ? styles.amberText : styles.errorText}>{error}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.purchaseBtn} onPress={purchaseReport} disabled={purchasing} activeOpacity={0.85}>
              {purchasing ? <ActivityIndicator color="#0D0D0D" /> : (
                <>
                  <Ionicons name="trophy" size={20} color="#0D0D0D" />
                  <Text style={styles.purchaseBtnText}>Get My Annual Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Has purchase but no saved report yet → generate screen
  if (!reportData) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={[styles.scroll, styles.centerContent]}>
          <Ionicons name="flame" size={56} color={colors.primary} />
          <Text style={styles.generateTitle}>Ready to face the truth?</Text>
          <Text style={styles.generateSub}>
            This analyzes every transaction you've uploaded — merchants, patterns, habits — and generates a deep financial post-mortem. Takes about 20–30 seconds.
          </Text>
          {error && (
            <View style={isDataError(error) ? styles.amberBox : styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={isDataError(error) ? '#F59E0B' : '#FF6B6B'} />
              <Text style={isDataError(error) ? styles.amberText : styles.errorText}>{error}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.generateBtn} onPress={generateReport} disabled={generating} activeOpacity={0.85}>
            {generating ? (
              <>
                <ActivityIndicator color="#0D0D0D" />
                <Text style={styles.generateBtnText}>Digging through every receipt…</Text>
              </>
            ) : (
              <>
                <Ionicons name="flame" size={20} color="#0D0D0D" />
                <Text style={styles.generateBtnText}>Generate My Annual Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const currency = reportData.currency;
  const catColors = ['#E85D26', '#C4A832', '#7B6FE8', '#3BB8A0', '#E8526A'];
  const maxCatAmt = reportData.top5Categories[0]?.amount || 1;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="trophy" size={32} color={colors.primary} />
          <Text style={styles.pageTitle}>Annual Report</Text>
        </View>

        {/* Generate Again banner — always requires payment */}
        <View style={styles.regenBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.regenBannerTitle}>
              {reportData.generatedAt ? `Generated ${fmtDate(reportData.generatedAt)}` : 'Your saved report'}
            </Text>
            <Text style={styles.regenBannerSub}>
              {generating ? 'Generating your updated report…' : 'Want fresher numbers? — $29.99'}
            </Text>
          </View>
          {generating ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <TouchableOpacity style={styles.regenBannerBtn} onPress={purchaseReport} disabled={purchasing} activeOpacity={0.85}>
              {purchasing
                ? <ActivityIndicator color="#0D0D0D" size="small" />
                : <Text style={styles.regenBannerBtnText}>Generate Again</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Error notice */}
        {error && (
          <View style={isDataError(error) ? styles.amberBox : styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={isDataError(error) ? '#F59E0B' : '#FF6B6B'} />
            <Text style={isDataError(error) ? styles.amberText : styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statValue}>{fmt(reportData.totalSpend, currency)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Monthly Avg</Text>
            <Text style={styles.statValue}>{fmt(reportData.avgMonthlySpend, currency)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statValue}>{reportData.transactionCount}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardDanger]}>
            <Text style={styles.statLabel}>5-yr Projection</Text>
            <Text style={[styles.statValue, { color: '#FF6B6B' }]}>{fmt(reportData.projection5yr, currency)}</Text>
          </View>
        </View>

        {/* Best vs Worst month */}
        <View style={styles.monthRow}>
          <View style={[styles.monthCard, { borderColor: 'rgba(74,222,128,0.3)' }]}>
            <Ionicons name="trending-down" size={14} color="#4ADE80" />
            <Text style={[styles.monthBadge, { color: '#4ADE80' }]}>BEST MONTH</Text>
            <Text style={styles.monthName}>{fmtMonth(reportData.bestMonth?.month)}</Text>
            <Text style={styles.monthAmount}>{fmt(reportData.bestMonth?.amount || 0, currency)}</Text>
          </View>
          <View style={[styles.monthCard, { borderColor: 'rgba(255,107,107,0.3)' }]}>
            <Ionicons name="trending-up" size={14} color="#FF6B6B" />
            <Text style={[styles.monthBadge, { color: '#FF6B6B' }]}>WORST MONTH</Text>
            <Text style={styles.monthName}>{fmtMonth(reportData.worstMonth?.month)}</Text>
            <Text style={styles.monthAmount}>{fmt(reportData.worstMonth?.amount || 0, currency)}</Text>
          </View>
        </View>

        {/* Spending Personality */}
        {reportData.spendingPersonality && (
          <View style={[styles.card, styles.personalityCard]}>
            <SectionHeader icon="person-circle" label="Your Spending Personality" color="#C4A832" />
            <Text style={styles.personalityTitle}>{reportData.spendingPersonality.title}</Text>
            <Text style={styles.cardBody}>{reportData.spendingPersonality.description}</Text>
          </View>
        )}

        {/* Top categories */}
        <View style={styles.card}>
          <SectionHeader icon="bar-chart" label="Top 5 Categories" />
          {reportData.top5Categories.map((cat, i) => {
            const pct = Math.round((cat.amount / reportData.totalSpend) * 100);
            const barWidth = Math.round((cat.amount / maxCatAmt) * 100);
            return (
              <View key={cat.category} style={styles.catRow}>
                <View style={styles.catMeta}>
                  <Text style={styles.catName}>{i + 1}. {cat.category}</Text>
                  <View style={styles.catRight}>
                    <Text style={styles.catPct}>{pct}%</Text>
                    <Text style={styles.catAmt}>{fmt(cat.amount, currency)}</Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barWidth}%` as any, backgroundColor: catColors[i] }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* The Roast */}
        <View style={[styles.card, styles.roastCard]}>
          <SectionHeader icon="flame" label="The Annual Roast" />
          <Text style={styles.roastText}>"{reportData.roast}"</Text>
        </View>

        {/* Fun Fact */}
        {reportData.funFact && (
          <View style={[styles.card, styles.funFactCard]}>
            <Ionicons name="sparkles" size={16} color="#C4A832" style={{ marginBottom: spacing.xs }} />
            <Text style={styles.cardBody}>{reportData.funFact}</Text>
          </View>
        )}

        {/* Behavioral Analysis */}
        <View style={styles.card}>
          <SectionHeader icon="brain" label="Behavioral Analysis" color={colors.textMuted} />
          <Text style={styles.cardBody}>{reportData.behavioralAnalysis}</Text>
        </View>

        {/* Monthly Trend */}
        {reportData.monthlyTrend && (
          <View style={[styles.card, styles.trendCard]}>
            <SectionHeader icon="trending-up" label="Spending Trend" color="#7B6FE8" />
            <Text style={styles.cardBody}>{reportData.monthlyTrend}</Text>
          </View>
        )}

        {/* Merchant Insights */}
        {reportData.merchantInsights?.length > 0 && (
          <View style={styles.card}>
            <SectionHeader icon="storefront" label="Merchant Insights" color="#3BB8A0" />
            {reportData.merchantInsights.map((m, i) => (
              <View key={i} style={styles.merchantRow}>
                <View style={styles.merchantBadge}>
                  <Text style={styles.merchantBadgeText}>{i + 1}</Text>
                </View>
                <View style={styles.merchantInfo}>
                  <View style={styles.merchantTopRow}>
                    <Text style={styles.merchantName}>{m.merchant}</Text>
                    <Text style={styles.merchantMeta}>{fmt(m.totalSpent, currency)} · {m.visits}x</Text>
                  </View>
                  <Text style={styles.merchantInsight}>{m.insight}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Savings Opportunities */}
        {reportData.savingsOpportunities?.length > 0 && (
          <View style={[styles.card, styles.savingsCard]}>
            <SectionHeader icon="bulb" label="Savings Opportunities" color="#4ADE80" />
            {reportData.savingsOpportunities.map((opp, i) => (
              <View key={i} style={styles.savingsItem}>
                <View style={styles.savingsTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savingsCat}>{opp.category}</Text>
                    <Text style={styles.savingsCurrentSpend}>Currently {fmt(opp.currentAnnualSpend, currency)}/yr</Text>
                  </View>
                  <View style={styles.savingsRight}>
                    <Text style={styles.savingsSaveLabel}>Save up to</Text>
                    <Text style={styles.savingsSaveAmt}>{fmt(opp.potentialAnnualSaving, currency)}/yr</Text>
                  </View>
                </View>
                <View style={styles.alternativeBadge}>
                  <Text style={styles.alternativeText}>Try instead: {opp.alternative}</Text>
                </View>
                <Text style={styles.savingsTip}>{opp.tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 5-Year Projection */}
        <View style={[styles.card, styles.projectionCard]}>
          <SectionHeader icon="warning" label={`5-Year Projection${reportData.allTimeYearsRange ? ` (${reportData.allTimeYearsRange} data)` : ''}`} color="#FF6B6B" />
          <Text style={styles.projectionSub}>If your habits remain completely unchanged:</Text>
          <Text style={styles.projectionAmt}>{fmt(reportData.projection5yr, currency)}</Text>
          <Text style={styles.projectionNote}>spent over the next 5 years at your current rate.</Text>
        </View>

        {/* Improvements */}
        <View style={[styles.card, styles.improvementsCard]}>
          <SectionHeader icon="rocket" label="5 Ways to Save Your Financial Life" color="#7B6FE8" />
          {reportData.improvements?.map((tip, i) => (
            <View key={i} style={styles.improvementRow}>
              <View style={styles.improvementNum}>
                <Text style={styles.improvementNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.improvementText}>{tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  centerContent: { alignItems: 'center', justifyContent: 'center', minHeight: 500 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageTitle: { ...typography.h2 },

  regenBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  regenBannerTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  regenBannerSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  regenBannerBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  regenBannerBtnText: { fontSize: 12, fontWeight: '700', color: '#0D0D0D' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  statCardDanger: { borderColor: 'rgba(255,107,107,0.3)' },
  statLabel: { ...typography.label, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.text },

  monthRow: { flexDirection: 'row', gap: spacing.sm },
  monthCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, gap: 2, borderWidth: 1,
  },
  monthBadge: { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  monthName: { ...typography.body, fontWeight: '700' },
  monthAmount: { ...typography.bodyMuted, fontSize: 13 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  personalityCard: { borderColor: 'rgba(196,168,50,0.3)', backgroundColor: 'rgba(196,168,50,0.05)' },
  roastCard: { borderColor: 'rgba(0,230,118,0.25)' },
  funFactCard: { borderColor: 'rgba(196,168,50,0.2)', backgroundColor: 'rgba(196,168,50,0.05)' },
  trendCard: { borderColor: 'rgba(123,111,232,0.2)' },
  savingsCard: { borderColor: 'rgba(74,222,128,0.2)' },
  projectionCard: { borderColor: 'rgba(255,107,107,0.25)', backgroundColor: 'rgba(255,107,107,0.05)' },
  improvementsCard: { borderColor: 'rgba(123,111,232,0.25)' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },

  personalityTitle: { fontSize: 22, fontWeight: '800', color: '#C4A832' },
  cardBody: { ...typography.body, lineHeight: 22, color: colors.textMuted },
  roastText: { ...typography.body, fontStyle: 'italic', lineHeight: 26, fontSize: 16, color: colors.text },

  catRow: { gap: 4, marginTop: 4 },
  catMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { ...typography.body, fontWeight: '600', flex: 1 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catPct: { ...typography.label, color: colors.textMuted },
  catAmt: { ...typography.body, fontWeight: '700' },
  barTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  merchantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  merchantBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(59,184,160,0.15)', alignItems: 'center', justifyContent: 'center' },
  merchantBadgeText: { fontSize: 12, fontWeight: '700', color: '#3BB8A0' },
  merchantInfo: { flex: 1, gap: 3 },
  merchantTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  merchantName: { ...typography.body, fontWeight: '700' },
  merchantMeta: { fontSize: 12, color: colors.textMuted },
  merchantInsight: { ...typography.bodyMuted, fontSize: 13, lineHeight: 20 },

  savingsItem: { gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(74,222,128,0.15)' },
  savingsTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  savingsCat: { ...typography.label, color: colors.textMuted, marginBottom: 2 },
  savingsCurrentSpend: { ...typography.body, fontWeight: '600' },
  savingsRight: { alignItems: 'flex-end' },
  savingsSaveLabel: { fontSize: 11, color: colors.textMuted },
  savingsSaveAmt: { fontSize: 16, fontWeight: '800', color: '#4ADE80' },
  alternativeBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  alternativeText: { fontSize: 12, color: '#4ADE80', fontWeight: '600' },
  savingsTip: { ...typography.bodyMuted, fontSize: 13, lineHeight: 20 },

  projectionSub: { ...typography.bodyMuted, fontSize: 13 },
  projectionAmt: { fontSize: 36, fontWeight: '800', color: '#FF6B6B' },
  projectionNote: { ...typography.bodyMuted, fontSize: 13 },

  improvementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingTop: spacing.xs },
  improvementNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(123,111,232,0.2)', borderWidth: 1, borderColor: 'rgba(123,111,232,0.3)', alignItems: 'center', justifyContent: 'center' },
  improvementNumText: { fontSize: 13, fontWeight: '800', color: '#7B6FE8' },
  improvementText: { ...typography.body, flex: 1, lineHeight: 22, paddingTop: 3 },

  promoCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)',
  },
  promoTitle: { ...typography.h2, textAlign: 'center' },
  promoSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  featureList: { gap: spacing.sm },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  featureText: { ...typography.body, flex: 1 },
  priceRow: { alignItems: 'center', gap: spacing.xs },
  price: { fontSize: 40, fontWeight: '800', color: colors.primary },
  priceNote: { ...typography.bodyMuted },
  purchaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.lg,
  },
  purchaseBtnText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },

  generateTitle: { ...typography.h2, textAlign: 'center', marginTop: spacing.lg },
  generateSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22, marginHorizontal: spacing.lg },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    borderRadius: radius.lg, marginTop: spacing.lg,
  },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: '#0D0D0D' },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)',
    borderRadius: radius.md, padding: spacing.md,
  },
  errorText: { color: '#FF6B6B', fontSize: 13, flex: 1, lineHeight: 20 },
  amberBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: radius.md, padding: spacing.md,
  },
  amberText: { color: '#F59E0B', fontSize: 13, flex: 1, lineHeight: 20 },
});
