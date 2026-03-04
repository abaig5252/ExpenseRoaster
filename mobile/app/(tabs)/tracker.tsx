import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator,
  Dimensions, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/lib/auth';
import { apiGet } from '../../src/lib/api';
import { colors, spacing, radius, typography } from '../../src/theme';

interface Expense {
  id: number;
  description: string;
  amount: number;
  currency: string;
  category: string;
  roast: string | null;
  date: string;
}

interface MonthlySeries {
  month: string;
  total: number;
  count: number;
}

interface AdviceBreakdown {
  category: string;
  roast: string;
  insight: string;
  potentialSaving: number;
  alternatives: string[];
}

interface FinancialAdvice {
  advice: string;
  topCategory: string;
  savingsPotential: number;
  breakdown: AdviceBreakdown[];
}

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H = 120;
const CATEGORY_COLORS = ['#E85D26', '#C4A832', '#7B6FE8', '#3BB8A0', '#E8526A', '#5BA85E', '#8A9099'];

function shortMonth(str: string) {
  const d = new Date(str + '-01');
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export default function TrackerScreen() {
  const { user } = useAuth();
  const isPremium = user?.tier === 'premium';

  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () => apiGet('/api/expenses'),
    enabled: isPremium,
  });

  const { data: series, isLoading: seriesLoading } = useQuery<MonthlySeries[]>({
    queryKey: ['/api/expenses/monthly-series'],
    queryFn: () => apiGet('/api/expenses/monthly-series'),
    enabled: isPremium,
  });

  const { data: advice } = useQuery<FinancialAdvice>({
    queryKey: ['/api/expenses/financial-advice'],
    queryFn: () => apiGet('/api/expenses/financial-advice'),
    enabled: isPremium && (expenses?.length ?? 0) > 0,
  });

  // ── Derived data ──────────────────────────────────────────────────
  const allExpenses = expenses ?? [];
  const isFiltered = selectedCats.size > 0;

  function toggleCat(cat: string) {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const filteredExpenses = useMemo(
    () => isFiltered ? allExpenses.filter(e => selectedCats.has(e.category)) : allExpenses,
    [allExpenses, selectedCats, isFiltered]
  );

  // Category totals from ALL expenses (bars always show full picture)
  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    allExpenses.forEach(e => { acc[e.category] = (acc[e.category] || 0) + e.amount; });
    return acc;
  }, [allExpenses]);

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  // Current month total
  const currentYM = new Date().toISOString().slice(0, 7);
  const displayMonthTotal = useMemo(() => {
    const src = isFiltered ? filteredExpenses : allExpenses;
    return src.filter(e => e.date?.slice(0, 7) === currentYM).reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses, allExpenses, isFiltered, currentYM]);

  // Monthly chart — filter by selected categories when active
  const chartData = useMemo(() => {
    if (!series) return [];
    if (!isFiltered) return series;
    const byMonth: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const ym = (e.date ?? '').slice(0, 7);
      if (ym) byMonth[ym] = (byMonth[ym] || 0) + e.amount;
    });
    return series.map(row => ({ ...row, total: byMonth[row.month] ?? 0 }));
  }, [series, filteredExpenses, isFiltered]);

  const maxTotal = Math.max(...(chartData.map(m => m.total) ?? [1]), 1);

  // Filtered advice
  const filteredBreakdown = useMemo(() => {
    if (!advice?.breakdown) return [];
    if (!isFiltered) return advice.breakdown;
    return advice.breakdown.filter(b => selectedCats.has(b.category));
  }, [advice, selectedCats, isFiltered]);

  // Recent transactions (filtered)
  const recentTx = useMemo(() => {
    return filteredExpenses
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [filteredExpenses]);

  // ── Currency display ──────────────────────────────────────────────
  const currency = user?.currency ?? 'USD';
  function fmt(cents: number) {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }

  if (!isPremium) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.locked}>
          <Ionicons name="lock-closed" size={48} color={colors.primary} />
          <Text style={s.lockedTitle}>Premium Feature</Text>
          <Text style={s.lockedSub}>Upgrade to Premium to see your monthly spending tracker and AI financial insights.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Monthly Tracker</Text>

        {/* Active filter chips */}
        {isFiltered && (
          <View style={s.filterBanner}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
              {Array.from(selectedCats).map(cat => (
                <TouchableOpacity key={cat} style={s.filterChip} onPress={() => toggleCat(cat)}>
                  <Text style={s.filterChipText}>{cat}</Text>
                  <Ionicons name="close" size={11} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setSelectedCats(new Set())} style={s.clearBtn}>
              <Text style={s.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary card */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>
            {isFiltered ? 'Filtered — This Month' : 'This Month'}
          </Text>
          <Text style={s.summaryAmount}>{fmt(displayMonthTotal)}</Text>
          {isFiltered && (
            <Text style={s.summaryFiltered}>{filteredExpenses.length} transactions</Text>
          )}
        </View>

        {/* Monthly history chart */}
        {seriesLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : chartData.length > 0 ? (
          <View style={s.chartCard}>
            <Text style={s.cardTitle}>
              {isFiltered ? 'Monthly Spending — Filtered' : 'Spending History'}
            </Text>
            <View style={[s.chart, { height: CHART_H + 48 }]}>
              {chartData.slice(-6).map((m) => {
                const barH = Math.max(4, (m.total / maxTotal) * CHART_H);
                return (
                  <View key={m.month} style={s.barCol}>
                    <Text style={s.barAmount}>
                      {m.total > 0 ? `${(m.total / 100).toFixed(0)}` : ''}
                    </Text>
                    <View style={[s.bar, { height: barH }]} />
                    <Text style={s.barLabel}>{shortMonth(m.month)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Ionicons name="bar-chart-outline" size={32} color={colors.textDim} />
            <Text style={s.emptyText}>No spending data yet. Upload receipts to start tracking.</Text>
          </View>
        )}

        {/* Spending by Category — clickable bars */}
        {sortedCategories.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Spending by Category</Text>
              {!isFiltered && <Text style={s.tapHint}>Tap to filter</Text>}
            </View>
            {sortedCategories.map(([cat, total], i) => {
              const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              const isSelected = selectedCats.has(cat);
              const isDimmed = isFiltered && !isSelected;

              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggleCat(cat)}
                  activeOpacity={0.7}
                  style={[
                    s.catRow,
                    isSelected && s.catRowSelected,
                    isDimmed && s.catRowDimmed,
                  ]}
                >
                  <View style={s.catTop}>
                    <View style={s.catNameRow}>
                      <Text style={s.catName}>{cat}</Text>
                      {isSelected && (
                        <View style={s.checkBadge}>
                          <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                        </View>
                      )}
                    </View>
                    <View style={s.catRight}>
                      <Text style={s.catPct}>{pct}%</Text>
                      <Text style={s.catTotal}>{fmt(total)}</Text>
                    </View>
                  </View>
                  <View style={s.barTrack}>
                    <View
                      style={[
                        s.barFill,
                        { width: `${pct}%` as any, backgroundColor: isSelected ? colors.primary : color },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Advice — filtered */}
        {advice && (
          <View style={s.adviceCard}>
            <View style={s.adviceHeader}>
              <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              <Text style={s.adviceTitle}>
                {isFiltered ? 'Category Advice' : 'AI Financial Advice'}
              </Text>
            </View>

            {!isFiltered && (
              <Text style={s.adviceText}>{advice.advice}</Text>
            )}

            {filteredBreakdown.length > 0 ? (
              filteredBreakdown.map((b, i) => (
                <View key={b.category} style={[s.breakdownCard, i > 0 && { marginTop: spacing.sm }]}>
                  <View style={s.breakdownHeader}>
                    <View style={s.catChip}>
                      <Text style={s.catChipText}>{b.category}</Text>
                    </View>
                    {b.potentialSaving > 0 && (
                      <Text style={s.savingText}>save ~{fmt(b.potentialSaving)}/mo</Text>
                    )}
                  </View>
                  {b.roast ? (
                    <View style={s.roastBox}>
                      <Ionicons name="flame" size={12} color="#FFB800" />
                      <Text style={s.roastText}>"{b.roast}"</Text>
                    </View>
                  ) : null}
                  <Text style={s.insightText}>{b.insight}</Text>
                </View>
              ))
            ) : isFiltered ? (
              <Text style={[typography.bodyMuted, { textAlign: 'center', paddingVertical: spacing.md }]}>
                No advice available for selected categories.
              </Text>
            ) : null}
          </View>
        )}

        {/* Recent Transactions — filtered */}
        {recentTx.length > 0 && (
          <View style={s.section}>
            <Text style={s.cardTitle}>
              {isFiltered ? 'Filtered Transactions' : 'Recent Transactions'}
            </Text>
            {recentTx.map((exp, i) => {
              const catIdx = sortedCategories.findIndex(([c]) => c === exp.category);
              const catColor = CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length] || colors.textMuted;
              return (
                <View key={exp.id} style={s.txItem}>
                  <View style={s.txTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.txDesc} numberOfLines={1}>{exp.description}</Text>
                      <View style={[s.txCatChip, { backgroundColor: catColor + '22' }]}>
                        <Text style={[s.txCatText, { color: catColor }]}>{exp.category}</Text>
                      </View>
                    </View>
                    <Text style={s.txAmount}>{fmt(exp.amount)}</Text>
                  </View>
                  {exp.roast && <Text style={s.txRoast} numberOfLines={2}>"{exp.roast}"</Text>}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  lockedTitle: { ...typography.h2 },
  lockedSub: { ...typography.bodyMuted, textAlign: 'center', lineHeight: 22 },
  pageTitle: { ...typography.h2 },

  filterBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(124,255,77,0.07)',
    borderWidth: 1, borderColor: 'rgba(124,255,77,0.2)',
    borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm,
  },
  filterScroll: { flex: 1 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryDim, borderWidth: 1,
    borderColor: 'rgba(124,255,77,0.3)', borderRadius: radius.full,
    paddingVertical: 4, paddingHorizontal: spacing.sm, marginRight: spacing.xs,
  },
  filterChipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  clearBtn: { paddingHorizontal: spacing.sm },
  clearText: { ...typography.caption, color: colors.textMuted },

  summaryCard: {
    backgroundColor: colors.primaryDim, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(124,255,77,0.2)',
  },
  summaryLabel: { ...typography.label, color: colors.primary },
  summaryAmount: { fontSize: 34, fontWeight: '800', color: colors.primary, marginTop: spacing.xs },
  summaryFiltered: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },

  chartCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bar: { width: '60%', backgroundColor: colors.primary, borderRadius: radius.xs ?? 4, minHeight: 4 },
  barLabel: { ...typography.caption, fontSize: 10 },
  barAmount: { ...typography.caption, fontSize: 9, color: colors.textDim },

  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { ...typography.bodyMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.h3 },
  tapHint: { ...typography.caption, color: colors.textDim },

  catRow: {
    padding: spacing.sm, borderRadius: radius.md, gap: spacing.xs,
  },
  catRowSelected: {
    backgroundColor: 'rgba(124,255,77,0.08)',
    borderWidth: 1, borderColor: 'rgba(124,255,77,0.3)',
  },
  catRowDimmed: { opacity: 0.35 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  catName: { ...typography.body, fontWeight: '600' },
  checkBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catPct: { ...typography.caption },
  catTotal: { ...typography.body, fontWeight: '700', color: colors.primary },
  barTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.full, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full },

  adviceCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(124,255,77,0.15)',
  },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adviceTitle: { ...typography.h3, color: colors.primary },
  adviceText: { ...typography.body, lineHeight: 24 },
  breakdownCard: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catChip: {
    backgroundColor: colors.primaryDim, borderRadius: radius.full,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(124,255,77,0.2)',
  },
  catChipText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  savingText: { ...typography.caption, color: '#7B6FE8' },
  roastBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    backgroundColor: 'rgba(255,184,0,0.08)', borderRadius: radius.sm,
    padding: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,184,0,0.15)',
  },
  roastText: { ...typography.caption, fontStyle: 'italic', flex: 1, lineHeight: 18 },
  insightText: { ...typography.bodyMuted, fontSize: 13, lineHeight: 20 },

  section: { gap: spacing.sm },
  txItem: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  txDesc: { ...typography.body, fontWeight: '600' },
  txCatChip: {
    alignSelf: 'flex-start', borderRadius: radius.full,
    paddingVertical: 2, paddingHorizontal: spacing.xs, marginTop: 2,
  },
  txCatText: { fontSize: 10, fontWeight: '600' },
  txAmount: { ...typography.body, fontWeight: '700', color: colors.primary, flexShrink: 0 },
  txRoast: { ...typography.bodyMuted, fontStyle: 'italic', fontSize: 12 },
});
